from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User, UserBookState, UserCustomBook, UserCustomMovie, UserMovieState
from app.schemas import (
    BookStateOut,
    BookStateUpsert,
    BulkSyncBookStates,
    BulkSyncMovieStates,
    CustomBookIn,
    CustomBookOut,
    CustomMovieIn,
    CustomMovieOut,
    MovieStateOut,
    MovieStateUpsert,
)

router = APIRouter(prefix="/user", tags=["user-data"])


# ── Movie states ──────────────────────────────────────────────────────────────

@router.get("/movies/states", response_model=list[MovieStateOut])
async def get_movie_states(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserMovieState).where(UserMovieState.user_id == current_user.id)
    )
    return result.scalars().all()


@router.put("/movies/states/{ranking}", response_model=MovieStateOut)
async def upsert_movie_state(
    ranking: int,
    body: MovieStateUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserMovieState).where(
            UserMovieState.user_id == current_user.id,
            UserMovieState.movie_ranking == ranking,
        )
    )
    row = result.scalar_one_or_none()

    if not body.watched and not body.in_list and not body.bookmarked:
        # All false — delete the row if it exists
        if row:
            await db.delete(row)
            await db.commit()
        return MovieStateOut(movie_ranking=ranking, watched=False, in_list=False, bookmarked=False)

    if row:
        row.watched = body.watched
        row.in_list = body.in_list
        row.bookmarked = body.bookmarked
    else:
        row = UserMovieState(
            user_id=current_user.id,
            movie_ranking=ranking,
            watched=body.watched,
            in_list=body.in_list,
            bookmarked=body.bookmarked,
        )
        db.add(row)

    await db.commit()
    await db.refresh(row)
    return row


@router.post("/movies/states/bulk", response_model=list[MovieStateOut])
async def bulk_sync_movie_states(
    body: BulkSyncMovieStates,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload all localStorage states at once (called on login)."""
    result = await db.execute(
        select(UserMovieState).where(UserMovieState.user_id == current_user.id)
    )
    existing = {row.movie_ranking: row for row in result.scalars().all()}

    for ranking, state in body.states.items():
        if not state.watched and not state.in_list and not state.bookmarked:
            continue
        if ranking in existing:
            row = existing[ranking]
            row.watched = state.watched
            row.in_list = state.in_list
            row.bookmarked = state.bookmarked
        else:
            row = UserMovieState(
                user_id=current_user.id,
                movie_ranking=ranking,
                watched=state.watched,
                in_list=state.in_list,
                bookmarked=state.bookmarked,
            )
            db.add(row)

    await db.commit()
    result = await db.execute(
        select(UserMovieState).where(UserMovieState.user_id == current_user.id)
    )
    return result.scalars().all()


# ── Book states ───────────────────────────────────────────────────────────────

@router.get("/books/states", response_model=list[BookStateOut])
async def get_book_states(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserBookState).where(UserBookState.user_id == current_user.id)
    )
    return result.scalars().all()


@router.put("/books/states/{ranking}", response_model=BookStateOut)
async def upsert_book_state(
    ranking: int,
    body: BookStateUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserBookState).where(
            UserBookState.user_id == current_user.id,
            UserBookState.book_ranking == ranking,
        )
    )
    row = result.scalar_one_or_none()

    if not body.read and not body.in_list and not body.bookmarked:
        if row:
            await db.delete(row)
            await db.commit()
        return BookStateOut(book_ranking=ranking, read=False, in_list=False, bookmarked=False)

    if row:
        row.read = body.read
        row.in_list = body.in_list
        row.bookmarked = body.bookmarked
    else:
        row = UserBookState(
            user_id=current_user.id,
            book_ranking=ranking,
            read=body.read,
            in_list=body.in_list,
            bookmarked=body.bookmarked,
        )
        db.add(row)

    await db.commit()
    await db.refresh(row)
    return row


@router.post("/books/states/bulk", response_model=list[BookStateOut])
async def bulk_sync_book_states(
    body: BulkSyncBookStates,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserBookState).where(UserBookState.user_id == current_user.id)
    )
    existing = {row.book_ranking: row for row in result.scalars().all()}

    for ranking, state in body.states.items():
        if not state.read and not state.in_list and not state.bookmarked:
            continue
        if ranking in existing:
            row = existing[ranking]
            row.read = state.read
            row.in_list = state.in_list
            row.bookmarked = state.bookmarked
        else:
            row = UserBookState(
                user_id=current_user.id,
                book_ranking=ranking,
                read=state.read,
                in_list=state.in_list,
                bookmarked=state.bookmarked,
            )
            db.add(row)

    await db.commit()
    result = await db.execute(
        select(UserBookState).where(UserBookState.user_id == current_user.id)
    )
    return result.scalars().all()


# ── Custom movies ─────────────────────────────────────────────────────────────

@router.get("/movies/custom", response_model=list[CustomMovieOut])
async def get_custom_movies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserCustomMovie).where(UserCustomMovie.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/movies/custom", response_model=CustomMovieOut, status_code=status.HTTP_201_CREATED)
async def add_custom_movie(
    body: CustomMovieIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    movie = UserCustomMovie(user_id=current_user.id, **body.model_dump())
    db.add(movie)
    await db.commit()
    await db.refresh(movie)
    return movie


@router.delete("/movies/custom/{client_ranking}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_movie(
    client_ranking: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserCustomMovie).where(
            UserCustomMovie.user_id == current_user.id,
            UserCustomMovie.client_ranking == client_ranking,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()


# ── Custom books ──────────────────────────────────────────────────────────────

@router.get("/books/custom", response_model=list[CustomBookOut])
async def get_custom_books(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserCustomBook).where(UserCustomBook.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/books/custom", response_model=CustomBookOut, status_code=status.HTTP_201_CREATED)
async def add_custom_book(
    body: CustomBookIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    book = UserCustomBook(user_id=current_user.id, **body.model_dump())
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return book


@router.delete("/books/custom/{client_ranking}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_book(
    client_ranking: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserCustomBook).where(
            UserCustomBook.user_id == current_user.id,
            UserCustomBook.client_ranking == client_ranking,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()
