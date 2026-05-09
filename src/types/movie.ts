export interface Movie {
id: number;
title: string;
overview: string;
poster_path: string;
backdrop_path: string;

release_date: string;

vote_average: number;

genre_ids: number[];

adult: boolean;

original_language: string;

popularity: number;

video: boolean;
}

export interface MovieResponse {
page: number;

results: Movie[];

total_pages: number;

total_results: number;
}
