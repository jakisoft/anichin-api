# Unofficial Anichin Scraper API

An unofficial REST API for scraping anime information from anichin.cafe. This service provides structured JSON data for the latest episodes, popular series, anime details, search functionality, and more, by parsing the website's HTML content.

## Features

-   Fetch featured anime from the homepage slider.
-   Get lists of the latest and most popular anime updates.
-   Search for anime by title with paginated results.
-   Browse the genre directory and retrieve paginated series lists for a selected genre.
-   Retrieve comprehensive details for a specific anime series, including synopsis, genres, and a full episode list.
-   Fetch specific episode information, including all available video embed URLs and download links.
-   Browse ongoing and completed anime series.
-   Get the weekly anime release schedule.

## Tech Stack

-   **Backend:** Node.js, Express.js
-   **Web Scraping:** Axios, Cheerio
-   **Middleware:** CORS, Morgan
-   **Templating:** EJS (for the root index page)
-   **Development:** Nodemon

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) (version 14 or newer) and [npm](https://www.npmjs.com/) installed on your machine.

### Installation

1.  Clone the repository to your local machine:
    ```bash
    git clone https://github.com/jakysoft/anichin-api.git
    ```
2.  Navigate into the project directory:
    ```bash
    cd anichin-api
    ```
3.  Install the required dependencies:
    ```bash
    npm install
    ```

### Running the Application

-   **For development:**
    This command uses `nodemon` to automatically restart the server on file changes.
    ```bash
    npm run dev
    ```

-   **For production:**
    This command starts the server using `node`.
    ```bash
    npm start
    ```

The server will be running on `http://localhost:2504` by default.

## Usage

The API provides several endpoints to access scraped data. All successful responses are wrapped in a JSON object with `status: true` and a `data` field.

### API Endpoints

-   **`GET /slide`**
    Fetches the list of featured anime from the homepage slider.
    > `http://localhost:2504/slide`

-   **`GET /popular`**
    Fetches the list of popular anime from the homepage.
    > `http://localhost:2504/popular`

-   **`GET /latest`**
    Fetches the latest anime episode updates. Supports pagination.
    -   `page` (optional): The page number to retrieve. Defaults to `1`.
    > `http://localhost:2504/latest?page=2`

-   **`GET /genres`**
    Fetches the available Anichin genre list.
    > `http://localhost:2504/genres`

-   **`GET /genres/:genre`**
    Fetches anime series for a selected genre. Supports pagination.
    -   `genre` (required): The genre slug, for example `action`.
    -   `page` (optional): The page number to retrieve. Defaults to `1`.
    > `http://localhost:2504/genres/action?page=2`

-   **`GET /detail/:slug`**
    Fetches detailed information for a specific anime series using its slug.
    > `http://localhost:2504/detail/boruto-naruto-next-generations`

-   **`GET /episode/:slug`**
    Fetches details for a specific episode, including all available embeds and download links.
    > `http://localhost:2504/episode/boruto-episode-293-end`

-   **`GET /search`**
    Searches for anime based on a query. Supports pagination.
    -   `q` (required): The search query.
    -   `page` (optional): The page number for the search results.
    > `http://localhost:2504/search?q=one piece&page=1`

-   **`GET /ongoing`**
    Fetches a list of ongoing anime series. Supports pagination.
    -   `page` (optional): The page number.
    > `http://localhost:2504/ongoing?page=1`

-   **`GET /completed`**
    Fetches a list of completed anime series. Supports pagination.
    -   `page` (optional): The page number.
    > `http://localhost:2504/completed?page=1`

-   **`GET /schedule`**
    Fetches the weekly release schedule, grouped by day.
    > `http://localhost:2504/schedule`

## License

This project is licensed under the MIT License.
