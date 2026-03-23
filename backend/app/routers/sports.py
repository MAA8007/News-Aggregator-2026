"""Sports data router — F1 via FastF1/Ergast, football via football-data.org v4."""

import asyncio
import base64
import io
import logging
import time
from datetime import datetime, timedelta
from typing import Any

import matplotlib
matplotlib.use("Agg")  # non-interactive backend — must be set before pyplot import
import matplotlib.pyplot as plt
import matplotlib.cm as mpl_cm
import matplotlib.colors as mpl_colors
import numpy as np
from matplotlib.collections import LineCollection

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import settings

router = APIRouter(prefix="/sports", tags=["sports"])
log = logging.getLogger(__name__)

# ── Simple in-memory TTL cache ────────────────────────────────────────────────

_cache: dict[str, tuple[Any, datetime]] = {}
_CACHE_TTL = timedelta(minutes=30)


def _cache_get(key: str) -> Any | None:
    if entry := _cache.get(key):
        data, ts = entry
        if datetime.now() - ts < _CACHE_TTL:
            return data
    return None


def _cache_set(key: str, data: Any) -> None:
    _cache[key] = (data, datetime.now())


# ── FastF1 helpers (blocking — run in thread pool executor) ──────────────────

_F1_CACHE_DIR = "/tmp/fastf1_cache"


def _ensure_f1_cache() -> None:
    import os  # noqa: PLC0415
    import fastf1  # noqa: PLC0415
    os.makedirs(_F1_CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(_F1_CACHE_DIR)


def _fetch_f1_driver_standings(season: int) -> list[dict]:
    from fastf1.ergast import Ergast  # noqa: PLC0415
    _ensure_f1_cache()
    ergast = Ergast()
    resp = ergast.get_driver_standings(season=season)
    if not resp.content:
        return []
    df = resp.content[0]
    result = []
    for _, row in df.iterrows():
        constructors = row.get("constructorNames") or []
        result.append({
            "position": int(row["position"]),
            "points": float(row["points"]),
            "wins": int(row["wins"]),
            "driver_id": str(row.get("driverId", "")),
            "given_name": str(row.get("givenName", "")),
            "family_name": str(row.get("familyName", "")),
            "nationality": str(row.get("nationality", "")),
            "constructor": constructors[0] if constructors else "",
            "code": str(row.get("code", "") or ""),
        })
    return result


def _fetch_f1_constructor_standings(season: int) -> list[dict]:
    from fastf1.ergast import Ergast  # noqa: PLC0415
    _ensure_f1_cache()
    ergast = Ergast()
    resp = ergast.get_constructor_standings(season=season)
    if not resp.content:
        return []
    df = resp.content[0]
    log.info("Constructor standings columns: %s", list(df.columns))
    result = []
    for _, row in df.iterrows():
        row_dict = row.to_dict()
        name = (
            row_dict.get("name")
            or row_dict.get("constructorName")
            or row_dict.get("Constructor_name")
            or next((v for k, v in row_dict.items() if "name" in k.lower() and isinstance(v, str) and v), "")
        )
        constructor_id = row_dict.get("constructorId") or row_dict.get("Constructor_constructorId") or ""
        nationality = row_dict.get("nationality") or row_dict.get("Constructor_nationality") or ""
        result.append({
            "position": int(row["position"]),
            "points": float(row["points"]),
            "wins": int(row["wins"]),
            "constructor_id": str(constructor_id),
            "name": str(name),
            "nationality": str(nationality),
        })
    return result


# ── Ergast helpers ────────────────────────────────────────────────────────────

def _safe_int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _safe_float(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _safe_str(v) -> str:
    if v is None:
        return ""
    s = str(v)
    return "" if s in ("nan", "NaT", "None") else s


def _td_to_str(v) -> str | None:
    """Convert pandas Timedelta to 'M:SS.mmm' string, or None if missing."""
    if v is None:
        return None
    try:
        import pandas as pd  # noqa: PLC0415
        if pd.isna(v):
            return None
    except Exception:
        pass
    try:
        total_s = float(v.total_seconds())
        mins = int(total_s // 60)
        secs = total_s % 60
        return f"{mins}:{secs:06.3f}"
    except Exception:
        s = str(v)
        return None if s in ("NaT", "nan", "None") else s


def _get_field(rd: dict, *keys: str, default: str = "") -> str:
    for k in keys:
        v = rd.get(k)
        if v is not None and str(v) not in ("nan", "NaT", "None", ""):
            return str(v)
    return default


def _fetch_f1_race_results(season: int, round_num: int) -> list[dict]:
    from fastf1.ergast import Ergast  # noqa: PLC0415
    _ensure_f1_cache()
    ergast = Ergast()
    resp = ergast.get_race_results(season=season, round=round_num)
    if not resp.content:
        return []
    df = resp.content[0]
    log.info("Race results columns: %s", list(df.columns))
    result = []
    for _, row in df.iterrows():
        rd = row.to_dict()
        result.append({
            "position": _safe_int(rd.get("position") or rd.get("classifiedPosition")),
            "points": _safe_float(rd.get("points")),
            "grid": _safe_int(rd.get("gridPosition") or rd.get("grid")),
            "laps": _safe_int(rd.get("laps")),
            "status": _get_field(rd, "status"),
            "time": _get_field(rd, "Time", "time"),
            "driver_id": _get_field(rd, "driverId", "Driver_driverId"),
            "given_name": _get_field(rd, "givenName", "Driver_givenName"),
            "family_name": _get_field(rd, "familyName", "Driver_familyName"),
            "constructor": _get_field(rd, "constructorName", "Constructor_name", "name"),
        })
    return result


def _fetch_f1_qualifying_results(season: int, round_num: int) -> list[dict]:
    from fastf1.ergast import Ergast  # noqa: PLC0415
    _ensure_f1_cache()
    ergast = Ergast()
    resp = ergast.get_qualifying_results(season=season, round=round_num)
    if not resp.content:
        return []
    df = resp.content[0]
    log.info("Qualifying results columns: %s", list(df.columns))
    result = []
    for _, row in df.iterrows():
        rd = row.to_dict()
        result.append({
            "position": _safe_int(rd.get("position")),
            "driver_id": _get_field(rd, "driverId", "Driver_driverId"),
            "given_name": _get_field(rd, "givenName", "Driver_givenName"),
            "family_name": _get_field(rd, "familyName", "Driver_familyName"),
            "constructor": _get_field(rd, "constructorName", "Constructor_name", "name"),
            "q1": _td_to_str(rd.get("Q1") or rd.get("q1")),
            "q2": _td_to_str(rd.get("Q2") or rd.get("q2")),
            "q3": _td_to_str(rd.get("Q3") or rd.get("q3")),
        })
    return result


def _fetch_f1_sprint_results(season: int, round_num: int) -> list[dict]:
    from fastf1.ergast import Ergast  # noqa: PLC0415
    _ensure_f1_cache()
    ergast = Ergast()
    try:
        resp = ergast.get_sprint_results(season=season, round=round_num)
    except AttributeError:
        return []
    if not resp.content:
        return []
    df = resp.content[0]
    log.info("Sprint results columns: %s", list(df.columns))
    result = []
    for _, row in df.iterrows():
        rd = row.to_dict()
        result.append({
            "position": _safe_int(rd.get("position")),
            "points": _safe_float(rd.get("points")),
            "grid": _safe_int(rd.get("gridPosition") or rd.get("grid")),
            "laps": _safe_int(rd.get("laps")),
            "status": _get_field(rd, "status"),
            "time": _get_field(rd, "Time", "time"),
            "driver_id": _get_field(rd, "driverId", "Driver_driverId"),
            "given_name": _get_field(rd, "givenName", "Driver_givenName"),
            "family_name": _get_field(rd, "familyName", "Driver_familyName"),
            "constructor": _get_field(rd, "constructorName", "Constructor_name", "name"),
        })
    return result


def _fmt_ts(ts) -> str | None:
    """Format a pandas Timestamp (or None/NaT) to 'YYYY-MM-DD HH:MM'."""
    if ts is None:
        return None
    try:
        import pandas as pd  # noqa: PLC0415
        if pd.isna(ts):
            return None
    except Exception:
        pass
    try:
        return ts.strftime("%Y-%m-%d %H:%M")
    except Exception:
        s = str(ts)
        return None if s in ("NaT", "nan", "None") else s


def _fetch_f1_schedule(season: int) -> list[dict]:
    import fastf1  # noqa: PLC0415
    _ensure_f1_cache()
    schedule = fastf1.get_event_schedule(season, include_testing=False)
    now = datetime.now()
    result = []
    for _, row in schedule.iterrows():
        event_date = row.get("EventDate")
        try:
            date_str = event_date.strftime("%Y-%m-%d")
            is_past = event_date.to_pydatetime().replace(tzinfo=None) < now
        except Exception:
            date_str = str(event_date)
            is_past = False

        # Collect all five sessions with their local and UTC times
        sessions = []
        for i in range(1, 6):
            s_name = row.get(f"Session{i}")
            s_name_str = str(s_name) if s_name is not None else ""
            if s_name_str in ("nan", "None", ""):
                continue
            sessions.append({
                "name":      s_name_str,
                "date_local": _fmt_ts(row.get(f"Session{i}Date")),
                "date_utc":   _fmt_ts(row.get(f"Session{i}DateUtc")),
            })

        result.append({
            "round":          int(row["RoundNumber"]),
            "event_name":     str(row.get("EventName", "")),
            "official_name":  str(row.get("OfficialEventName", "")),
            "country":        str(row.get("Country", "")),
            "location":       str(row.get("Location", "")),
            "date":           date_str,
            "format":         str(row.get("EventFormat", "conventional")),
            "is_past":        is_past,
            "f1_api_support": bool(row.get("F1ApiSupport", False)),
            "sessions":       sessions,
        })
    return result


# ── F1 endpoints ──────────────────────────────────────────────────────────────

@router.get("/f1/driver-standings")
async def f1_driver_standings(season: int = Query(default=2026)):
    key = f"f1_drivers_{season}"
    if cached := _cache_get(key):
        return cached
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _fetch_f1_driver_standings, season)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/constructor-standings")
async def f1_constructor_standings(season: int = Query(default=2026)):
    key = f"f1_constructors_{season}"
    if cached := _cache_get(key):
        return cached
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _fetch_f1_constructor_standings, season)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/schedule")
async def f1_schedule(season: int = Query(default=2026)):
    key = f"f1_schedule_{season}"
    if cached := _cache_get(key):
        return cached
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _fetch_f1_schedule, season)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/race-results")
async def f1_race_results(season: int = Query(default=2026), round: int = Query(...)):
    key = f"f1_race_{season}_{round}"
    if cached := _cache_get(key):
        return cached
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _fetch_f1_race_results, season, round)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/qualifying-results")
async def f1_qualifying_results(season: int = Query(default=2026), round: int = Query(...)):
    key = f"f1_qual_{season}_{round}"
    if cached := _cache_get(key):
        return cached
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _fetch_f1_qualifying_results, season, round)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/sprint-results")
async def f1_sprint_results(season: int = Query(default=2026), round: int = Query(...)):
    key = f"f1_sprint_{season}_{round}"
    if cached := _cache_get(key):
        return cached
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _fetch_f1_sprint_results, season, round)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


# ── Chart generation helpers ──────────────────────────────────────────────────

_CHART_BG   = "#111111"
_CHART_FG   = "#d0d0d0"
_CHART_GRID = "#2a2a2a"

_COLORS = [
    "#e8a838", "#dd5588", "#5599ff", "#55cc88",
    "#ff7744", "#aa55ff", "#ffdd55", "#44ccff",
]


def _fig_to_b64(fig: plt.Figure) -> str:
    """Render figure to base64-encoded PNG and close it."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight",
                facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode()


def _style_ax(ax: plt.Axes) -> None:
    ax.set_facecolor(_CHART_BG)
    ax.tick_params(colors=_CHART_FG, labelsize=8)
    for sp in ax.spines.values():
        sp.set_edgecolor("#3a3a3a")


def _rotate(xy: np.ndarray, *, angle: float) -> np.ndarray:
    c, s = np.cos(angle), np.sin(angle)
    return xy @ np.array([[c, s], [-s, c]])


def _load_viz_session(season: int, round_num: int, session_id: str,
                      laps: bool = True, telemetry: bool = False):
    import fastf1  # noqa: PLC0415
    _ensure_f1_cache()
    s = fastf1.get_session(season, round_num, session_id)
    s.load(laps=laps, telemetry=telemetry, weather=False, messages=False)
    return s


def _chart_track_map(season: int, round_num: int, session_id: str) -> dict:
    s = _load_viz_session(season, round_num, session_id, laps=True, telemetry=True)
    lap = s.laps.pick_fastest()
    pos = lap.get_pos_data()
    ci = s.get_circuit_info()

    track = pos.loc[:, ("X", "Y")].to_numpy()
    angle = ci.rotation / 180 * np.pi
    t_rot = _rotate(track, angle=angle)

    fig, ax = plt.subplots(figsize=(8, 6), facecolor=_CHART_BG)
    _style_ax(ax)
    ax.plot(t_rot[:, 0], t_rot[:, 1], color="#444", lw=12, solid_capstyle="round", zorder=0)
    ax.plot(t_rot[:, 0], t_rot[:, 1], color="#888", lw=3, solid_capstyle="round", zorder=1)

    off = np.array([500.0, 0.0])
    for _, corner in ci.corners.iterrows():
        txt = f"{int(corner['Number'])}{corner['Letter']}"
        oa = corner["Angle"] / 180 * np.pi
        off_rot = _rotate(off, angle=oa)
        cx, cy = _rotate(np.array([[corner["X"] + off_rot[0], corner["Y"] + off_rot[1]]]), angle=angle)[0]
        tx, ty = _rotate(np.array([[corner["X"], corner["Y"]]]), angle=angle)[0]
        ax.scatter(cx, cy, color="#3a3a3a", s=110, zorder=3)
        ax.plot([tx, cx], [ty, cy], color="#555", lw=0.8, zorder=2)
        ax.text(cx, cy, txt, ha="center", va="center_baseline", size=6, color=_CHART_FG, zorder=4)

    title = f"{s.event['Location']} {season} — Track Map ({session_id})"
    ax.set_title(title, color=_CHART_FG, fontsize=11, pad=10)
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_aspect("equal")
    for sp in ax.spines.values():
        sp.set_visible(False)
    fig.tight_layout()
    return {"image": _fig_to_b64(fig), "title": title}


def _chart_speed_map(season: int, round_num: int, session_id: str, driver: str | None) -> dict:
    s = _load_viz_session(season, round_num, session_id, laps=True, telemetry=True)
    lap = s.laps.pick_drivers(driver).pick_fastest() if driver else s.laps.pick_fastest()
    ci = s.get_circuit_info()
    angle = ci.rotation / 180 * np.pi

    tel = lap.get_telemetry()
    xy = np.column_stack([tel["X"].values, tel["Y"].values])
    xy_r = _rotate(xy, angle=angle)
    speed = tel["Speed"].values.astype(float)

    pts = xy_r.reshape(-1, 1, 2)
    segs = np.concatenate([pts[:-1], pts[1:]], axis=1)

    fig, ax = plt.subplots(figsize=(8, 6), facecolor=_CHART_BG)
    ax.set_facecolor(_CHART_BG); ax.axis("off")
    ax.plot(xy_r[:, 0], xy_r[:, 1], color="#2a2a2a", lw=14, zorder=0)
    norm = mpl_colors.Normalize(speed.min(), speed.max())
    lc = LineCollection(segs, cmap="plasma", norm=norm, lw=5, zorder=1)
    lc.set_array(speed)
    ax.add_collection(lc)
    ax.set_aspect("equal"); ax.autoscale()

    sm = plt.cm.ScalarMappable(cmap="plasma", norm=norm)
    cb = fig.colorbar(sm, ax=ax, orientation="horizontal", fraction=0.04, pad=0.03)
    cb.set_label("Speed (km/h)", color=_CHART_FG, fontsize=8)
    cb.ax.tick_params(colors=_CHART_FG, labelsize=7)
    cb.outline.set_edgecolor("#444")

    drv_lbl = driver or str(lap["Driver"])
    title = f"{s.event['Location']} {season} — {drv_lbl} Speed Map ({session_id})"
    ax.set_title(title, color=_CHART_FG, fontsize=11, pad=10)
    fig.tight_layout()
    return {"image": _fig_to_b64(fig), "title": title}


def _chart_gear_map(season: int, round_num: int, session_id: str) -> dict:
    s = _load_viz_session(season, round_num, session_id, laps=True, telemetry=True)
    lap = s.laps.pick_fastest()
    ci = s.get_circuit_info()
    angle = ci.rotation / 180 * np.pi

    tel = lap.get_telemetry()
    xy = np.column_stack([tel["X"].values, tel["Y"].values])
    xy_r = _rotate(xy, angle=angle)
    gear = tel["nGear"].to_numpy().astype(float)

    pts = xy_r.reshape(-1, 1, 2)
    segs = np.concatenate([pts[:-1], pts[1:]], axis=1)

    cmap = mpl_cm.get_cmap("Paired")
    fig, ax = plt.subplots(figsize=(8, 6), facecolor=_CHART_BG)
    ax.set_facecolor(_CHART_BG); ax.axis("off")
    ax.plot(xy_r[:, 0], xy_r[:, 1], color="#2a2a2a", lw=14, zorder=0)
    lc = LineCollection(segs, norm=plt.Normalize(1, cmap.N + 1), cmap=cmap, lw=5, zorder=1)
    lc.set_array(gear)
    ax.add_collection(lc)
    ax.set_aspect("equal"); ax.autoscale()

    cb = fig.colorbar(lc, ax=ax, orientation="horizontal", fraction=0.04, pad=0.03,
                      boundaries=np.arange(1, 10))
    cb.set_ticks(np.arange(1.5, 9.5))
    cb.set_ticklabels([str(g) for g in range(1, 9)])
    cb.set_label("Gear", color=_CHART_FG, fontsize=8)
    cb.ax.tick_params(colors=_CHART_FG, labelsize=7)
    cb.outline.set_edgecolor("#444")

    title = f"{s.event['Location']} {season} — {lap['Driver']} Gear Map ({session_id})"
    ax.set_title(title, color=_CHART_FG, fontsize=11, pad=10)
    fig.tight_layout()
    return {"image": _fig_to_b64(fig), "title": title}


def _chart_speed_trace(season: int, round_num: int, session_id: str, drivers: list[str]) -> dict:
    import fastf1.plotting as ff1p  # noqa: PLC0415
    s = _load_viz_session(season, round_num, session_id, laps=True, telemetry=True)
    ci = s.get_circuit_info()

    fig, ax = plt.subplots(figsize=(10, 5), facecolor=_CHART_BG)
    _style_ax(ax)

    targets = drivers if drivers else ["fastest"]
    for i, drv in enumerate(targets):
        try:
            lap = s.laps.pick_drivers(drv).pick_fastest() if drv != "fastest" else s.laps.pick_fastest()
            tel = lap.get_car_data().add_distance()
            try:
                color = ff1p.get_team_color(lap["Team"], session=s)
            except Exception:
                color = _COLORS[i % len(_COLORS)]
            label = str(lap["Driver"]) if drv == "fastest" else drv
            ax.plot(tel["Distance"], tel["Speed"], color=color, label=label, lw=1.8)
        except Exception as exc:
            log.warning("Speed trace %s: %s", drv, exc)

    if ci is not None and not ci.corners.empty and "Distance" in ci.corners.columns:
        try:
            y0, y1 = ax.get_ylim()
            ax.vlines(ci.corners["Distance"], y0, y1, colors="#3a3a3a", lw=0.7, ls=":", zorder=0)
            for _, c in ci.corners.iterrows():
                ax.text(c["Distance"], y0 - 8, f"{int(c['Number'])}{c['Letter']}",
                        ha="center", va="top", size=6, color="#666")
        except Exception:
            pass

    ax.set_xlabel("Distance (m)", color=_CHART_FG, fontsize=9)
    ax.set_ylabel("Speed (km/h)", color=_CHART_FG, fontsize=9)
    ax.grid(axis="y", color=_CHART_GRID, lw=0.5)
    ax.legend(facecolor="#1c1c1c", edgecolor="#444", labelcolor=_CHART_FG, fontsize=8)
    title = f"{s.event['Location']} {season} — Speed Trace ({session_id})"
    ax.set_title(title, color=_CHART_FG, fontsize=11, pad=10)
    fig.tight_layout()
    return {"image": _fig_to_b64(fig), "title": title}


def _chart_position_changes(season: int, round_num: int) -> dict:
    import fastf1.plotting as ff1p  # noqa: PLC0415
    s = _load_viz_session(season, round_num, "R", laps=True, telemetry=False)

    fig, ax = plt.subplots(figsize=(10, 6), facecolor=_CHART_BG)
    _style_ax(ax)

    for drv in s.drivers:
        try:
            laps = s.laps.pick_drivers(drv)
            if laps.empty:
                continue
            abb = laps["Driver"].iloc[0]
            try:
                style = ff1p.get_driver_style(identifier=abb, style=["color", "linestyle"], session=s)
            except Exception:
                style = {"color": "#888", "linestyle": "solid"}
            ax.plot(laps["LapNumber"], laps["Position"], lw=1.2, label=abb, **style)
        except Exception:
            pass

    ax.set_ylim([20.5, 0.5])
    ax.set_yticks([1, 5, 10, 15, 20])
    ax.set_xlabel("Lap", color=_CHART_FG, fontsize=9)
    ax.set_ylabel("Position", color=_CHART_FG, fontsize=9)
    ax.grid(color=_CHART_GRID, lw=0.5)
    ax.legend(bbox_to_anchor=(1.01, 1), loc="upper left",
              facecolor="#1c1c1c", edgecolor="#444", labelcolor=_CHART_FG, fontsize=7, ncol=2)
    title = f"{s.event['Location']} {season} — Position Changes"
    ax.set_title(title, color=_CHART_FG, fontsize=11, pad=10)
    fig.tight_layout()
    return {"image": _fig_to_b64(fig), "title": title}


def _chart_tyre_strategy(season: int, round_num: int) -> dict:
    import fastf1.plotting as ff1p  # noqa: PLC0415
    s = _load_viz_session(season, round_num, "R", laps=True, telemetry=False)
    laps = s.laps
    try:
        drivers = [s.get_driver(d)["Abbreviation"] for d in s.drivers]
    except Exception:
        drivers = list(laps["Driver"].unique())

    stints = (laps[["Driver", "Stint", "Compound", "LapNumber"]]
              .groupby(["Driver", "Stint", "Compound"]).count()
              .reset_index().rename(columns={"LapNumber": "StintLength"}))

    fig, ax = plt.subplots(figsize=(10, max(4, len(drivers) * 0.48)), facecolor=_CHART_BG)
    _style_ax(ax)

    for drv in drivers:
        prev = 0
        for _, row in stints[stints["Driver"] == drv].iterrows():
            try:
                c_color = ff1p.get_compound_color(row["Compound"], session=s)
            except Exception:
                c_color = "#888"
            ax.barh(drv, row["StintLength"], left=prev, color=c_color, edgecolor="#111", lw=0.5)
            prev += int(row["StintLength"])

    ax.invert_yaxis()
    ax.set_xlabel("Lap", color=_CHART_FG, fontsize=9)
    ax.grid(axis="x", color=_CHART_GRID, lw=0.5)
    for sp in ["top", "right", "left"]:
        ax.spines[sp].set_visible(False)
    title = f"{s.event['Location']} {season} — Tyre Strategy"
    ax.set_title(title, color=_CHART_FG, fontsize=11, pad=10)
    fig.tight_layout()
    return {"image": _fig_to_b64(fig), "title": title}


def _chart_lap_times(season: int, round_num: int, session_id: str, drivers: list[str]) -> dict:
    import fastf1.plotting as ff1p  # noqa: PLC0415
    s = _load_viz_session(season, round_num, session_id, laps=True, telemetry=False)

    fig, ax = plt.subplots(figsize=(10, 6), facecolor=_CHART_BG)
    _style_ax(ax)

    try:
        targets = drivers if drivers else [s.get_driver(d)["Abbreviation"] for d in s.drivers[:12]]
    except Exception:
        targets = drivers or []

    for i, drv in enumerate(targets):
        try:
            dlaps = s.laps.pick_drivers(drv).pick_quicklaps().reset_index()
            if dlaps.empty:
                continue
            lt_s = dlaps["LapTime"].dt.total_seconds()
            try:
                color = ff1p.get_team_color(dlaps["Team"].iloc[0], session=s)
            except Exception:
                color = _COLORS[i % len(_COLORS)]
            ax.scatter(dlaps["LapNumber"], lt_s, color=color, s=18, label=drv, alpha=0.85, zorder=2)
        except Exception as exc:
            log.warning("Lap times %s: %s", drv, exc)

    ax.set_xlabel("Lap Number", color=_CHART_FG, fontsize=9)
    ax.set_ylabel("Lap Time (s)", color=_CHART_FG, fontsize=9)
    ax.grid(color=_CHART_GRID, lw=0.5)
    ax.legend(facecolor="#1c1c1c", edgecolor="#444", labelcolor=_CHART_FG, fontsize=8)
    title = f"{s.event['Location']} {season} — Lap Times ({session_id})"
    ax.set_title(title, color=_CHART_FG, fontsize=11, pad=10)
    fig.tight_layout()
    return {"image": _fig_to_b64(fig), "title": title}


def _chart_team_pace(season: int, round_num: int) -> dict:
    import fastf1.plotting as ff1p  # noqa: PLC0415
    s = _load_viz_session(season, round_num, "R", laps=True, telemetry=False)
    laps = s.laps.pick_quicklaps().copy()
    laps["lt_s"] = laps["LapTime"].dt.total_seconds()

    team_order = (laps.groupby("Team")["lt_s"].median().sort_values().index.tolist())
    n = len(team_order)

    fig, ax = plt.subplots(figsize=(max(8, n * 1.2), 6), facecolor=_CHART_BG)
    _style_ax(ax)

    for i, team in enumerate(team_order):
        data = laps.loc[laps["Team"] == team, "lt_s"]
        q1, q3 = data.quantile(0.25), data.quantile(0.75)
        med = float(data.median())
        iqr = q3 - q1
        lo = float(max(data.min(), q1 - 1.5 * iqr))
        hi = float(min(data.max(), q3 + 1.5 * iqr))
        try:
            color = ff1p.get_team_color(team, session=s)
        except Exception:
            color = _COLORS[i % len(_COLORS)]
        ax.fill_between([i - 0.3, i + 0.3], q1, q3, color=color, alpha=0.35, zorder=2)
        ax.hlines(med, i - 0.3, i + 0.3, colors=color, lw=2.5, zorder=3)
        ax.vlines(i, lo, hi, colors=color, lw=1.5, zorder=2)
        ax.hlines([lo, hi], i - 0.15, i + 0.15, colors=color, lw=1.5, zorder=2)
        outliers = data[(data < lo) | (data > hi)]
        if len(outliers):
            ax.scatter([i] * len(outliers), outliers, color=color, s=8, alpha=0.5, zorder=4)

    ax.set_xticks(range(n))
    ax.set_xticklabels([t.replace(" ", "\n") for t in team_order], fontsize=7, color=_CHART_FG)
    ax.set_ylabel("Lap Time (s)", color=_CHART_FG, fontsize=9)
    ax.grid(axis="y", color=_CHART_GRID, lw=0.5)
    title = f"{s.event['Location']} {season} — Team Pace"
    ax.set_title(title, color=_CHART_FG, fontsize=11, pad=10)
    fig.tight_layout()
    return {"image": _fig_to_b64(fig), "title": title}


# ── F1 visualization endpoints ─────────────────────────────────────────────────

def _viz_endpoint(fn, *args):
    """Shared pattern: run blocking chart fn in executor, cache result."""
    pass  # implemented inline below


@router.get("/f1/viz/track-map")
async def viz_track_map(
    season: int = Query(default=2026),
    round: int = Query(...),
    session: str = Query(default="Q"),
):
    key = f"viz_trackmap_{season}_{round}_{session}"
    if cached := _cache_get(key):
        return cached
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _chart_track_map, season, round, session
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/viz/speed-map")
async def viz_speed_map(
    season: int = Query(default=2026),
    round: int = Query(...),
    session: str = Query(default="Q"),
    driver: str | None = Query(default=None),
):
    key = f"viz_speedmap_{season}_{round}_{session}_{driver}"
    if cached := _cache_get(key):
        return cached
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _chart_speed_map, season, round, session, driver
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/viz/gear-map")
async def viz_gear_map(
    season: int = Query(default=2026),
    round: int = Query(...),
    session: str = Query(default="Q"),
):
    key = f"viz_gearmap_{season}_{round}_{session}"
    if cached := _cache_get(key):
        return cached
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _chart_gear_map, season, round, session
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/viz/speed-trace")
async def viz_speed_trace(
    season: int = Query(default=2026),
    round: int = Query(...),
    session: str = Query(default="Q"),
    drivers: str = Query(default=""),
):
    key = f"viz_speedtrace_{season}_{round}_{session}_{drivers}"
    if cached := _cache_get(key):
        return cached
    drv_list = [d.strip() for d in drivers.split(",") if d.strip()]
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _chart_speed_trace, season, round, session, drv_list
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/viz/position-changes")
async def viz_position_changes(
    season: int = Query(default=2026),
    round: int = Query(...),
):
    key = f"viz_positions_{season}_{round}"
    if cached := _cache_get(key):
        return cached
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _chart_position_changes, season, round
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/viz/tyre-strategy")
async def viz_tyre_strategy(
    season: int = Query(default=2026),
    round: int = Query(...),
):
    key = f"viz_tyres_{season}_{round}"
    if cached := _cache_get(key):
        return cached
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _chart_tyre_strategy, season, round
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/viz/lap-times")
async def viz_lap_times(
    season: int = Query(default=2026),
    round: int = Query(...),
    session: str = Query(default="R"),
    drivers: str = Query(default=""),
):
    key = f"viz_laptimes_{season}_{round}_{session}_{drivers}"
    if cached := _cache_get(key):
        return cached
    drv_list = [d.strip() for d in drivers.split(",") if d.strip()]
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _chart_lap_times, season, round, session, drv_list
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


@router.get("/f1/viz/team-pace")
async def viz_team_pace(
    season: int = Query(default=2026),
    round: int = Query(...),
):
    key = f"viz_teampace_{season}_{round}"
    if cached := _cache_get(key):
        return cached
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _chart_team_pace, season, round
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, result)
    return result


# ── football-data.org helpers ─────────────────────────────────────────────────

_FD_BASE = "https://api.football-data.org/v4"
_fd_timestamps: list[float] = []
_fd_lock = asyncio.Lock()


async def _fd_throttle() -> None:
    """Sliding-window rate limiter — max 10 requests per 60 s."""
    async with _fd_lock:
        now = time.monotonic()
        _fd_timestamps[:] = [t for t in _fd_timestamps if now - t < 60.0]
        if len(_fd_timestamps) >= 10:
            wait = 60.0 - (now - _fd_timestamps[0]) + 0.1
            log.info("football-data throttle: sleeping %.1f s", wait)
            await asyncio.sleep(wait)
            now = time.monotonic()
            _fd_timestamps[:] = [t for t in _fd_timestamps if now - t < 60.0]
        _fd_timestamps.append(time.monotonic())


async def _fd_get(path: str, params: dict | None = None) -> dict:
    await _fd_throttle()
    headers = {"X-Auth-Token": settings.FOOTBALL_DATA_KEY}
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(f"{_FD_BASE}{path}", params=params or {}, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        log.info("football-data %s %s → keys=%s", path, params, list(data.keys()) if isinstance(data, dict) else "?")
        return data


# ── Football endpoints (football-data.org) ────────────────────────────────────

@router.get("/football/standings")
async def football_standings(competition: str = Query(...)):
    key = f"fd_standings_{competition}"
    if cached := _cache_get(key):
        return cached
    try:
        data = await _fd_get(f"/competitions/{competition}/standings")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, data)
    return data


@router.get("/football/scorers")
async def football_scorers(competition: str = Query(...), limit: int = Query(default=20)):
    key = f"fd_scorers_{competition}_{limit}"
    if cached := _cache_get(key):
        return cached
    try:
        data = await _fd_get(f"/competitions/{competition}/scorers", {"limit": limit})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, data)
    return data


@router.get("/football/matches")
async def football_matches(competition: str = Query(...)):
    key = f"fd_matches_{competition}"
    if cached := _cache_get(key):
        return cached
    try:
        data = await _fd_get(f"/competitions/{competition}/matches")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, data)
    return data


@router.get("/football/team/{team_id}/matches")
async def team_matches(
    team_id: int,
    status: str | None = Query(default=None),
    limit: int = Query(default=15),
):
    key = f"fd_team_{team_id}_{status}_{limit}"
    if cached := _cache_get(key):
        return cached
    params: dict = {"limit": limit}
    if status:
        params["status"] = status
    try:
        data = await _fd_get(f"/teams/{team_id}/matches", params)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, data)
    return data


@router.get("/football/head2head/{match_id}")
async def head2head(match_id: int, limit: int = Query(default=10)):
    key = f"fd_h2h_{match_id}_{limit}"
    if cached := _cache_get(key):
        return cached
    try:
        data = await _fd_get(f"/matches/{match_id}/head2head", {"limit": limit})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _cache_set(key, data)
    return data
