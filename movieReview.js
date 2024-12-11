const http = require("http");
const path = require("path");
const express = require("express");
const app = express();
const httpSuccessStatus = 200;
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended:false}));
require("dotenv").config({ path: path.resolve(__dirname, '.env') }) 

let username = process.env.MONGO_DB_USERNAME;
let password = process.env.MONGO_DB_PASSWORD;

const uri = `mongodb+srv://${username}:${password}@cluster0.9c9xr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion } = require('mongodb');
const { lookup } = require("dns");
const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1});

const API_KEY = 'b4cc1523'
//const API_REQ = `http://www.omdbapi.com/?apikey=${API_KEY}`
const API_REQ = 'https://www.omdbapi.com/?s=blade runner&apikey=b4cc1523'

const portNumber = 5005;

app.listen(portNumber);
console.log(`Web server started`);

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("homepage");
});

app.post("/", async (req, res) => {
    let movie_Title = req.body.movieTitle;

    let movie_results = await movie_search(movie_Title)
    let movie_cards = await display_movies(movie_results)
    
    let params = {movie_Title:movie_Title, table_data:movie_cards}

    res.render("search_results", params)
});

app.get('/movie/:id', async(req, res) => {
    const imdbID = req.params.id
    let movie_data = await movie_information(imdbID)
    let review_data = await lookUpReviews(client, databaseAndCollection, imdbID);

    let variables = {
        movie_title: movie_data.Title.toUpperCase(),
        movie_year: movie_data.Year,
        movie_synopsis: movie_data.Plot,
        movie_poster: movie_data.Poster,
        star_rating: movie_data.imdbRating,
        movie_reviews: review_data,
        imdbID: movie_data.imdbID
    }

    res.render("movie", variables);

})

app.get("/review/:id/:title", async (req, res) => {
    const imdbID = req.params.id;
    const title = req.params.title;

    const variables = {
        movie_title: title,
        movieID: imdbID
    };

    res.render("reviewForm", variables);
});

app.post("/review/:id/:title", async (req, res) => {
    let {username, movieID, movieTitle, stars} = req.body;
    let {usersreview} = req.body;

    const variables = {
        username: username,
        movieID: movieID,
        movieTitle: movieTitle,
        stars: stars,
        usersreview: usersreview
    };

    const newReview = {username: username, movieID: movieID, movieTitle: movieTitle, stars: stars, usersreview: usersreview};

    await insertReview(client, databaseAndCollection, newReview);

    res.render("reviewConfirmed", variables);
});

async function insertReview(client, databaseAndCollection, newReview) {
    try {
        await client.connect();

        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newReview);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function lookUpReviews(client, databaseAndCollection, movieID) {
    try {
        await client.connect();

        let filter = {movieID: movieID};
        const cursor = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).find(filter);

        const result = await cursor.toArray();

        let toRet = "";

        result.forEach(elem => {
            toRet += `<li>Star Rating: ${elem.stars} Review: ${elem.usersreview}</li>`;
        });

        let finalRet = "";

        if (toRet !== "") {
            finalRet = `<ul>` + toRet + `</ul>`;
        } else {
            toRet = "No movie reviews found";
        }

        return toRet;

    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }
}

async function test() {
    const res = await fetch(API_REQ);
    const json = await res.json();
    console.log(json)

}

async function movie_search(movie_title) {
    const res = await fetch(`https://www.omdbapi.com/?s=${movie_title}&apikey=b4cc1523`);
    const json = await res.json();
    return json
}

//Use after get request sent for a specific movie
async function movie_information(imdb_ID) {
    const res = await fetch(`https://www.omdbapi.com/?i=${imdb_ID}&apikey=b4cc1523`);
    const json = await res.json();
    return json;
}

async function display_movies(movie_results) {
    ans = '<tr>'
    count = 1

    movie_results.Search.forEach(movie => {
        let {Poster, Title, Year, imdbID} = movie
        if (count <= 6) {
            ans += 
            `<td><div class="movie-box">
                <form action = '/movie/${imdbID}' method = 'get'>
                    <!-- Movie Poster -->
                    <input type= "image" src="${Poster}">
                    
                    <!-- Movie Title -->
                    <div class="movie-title">${Title}</div>
                    
                    <!-- Movie Year -->
                    <div class="movie-year">${Year}</div>
                </form>
            </div></td>`
        }
        if (count == 3) {
            ans += '</tr> <tr>'
        } else if (count == 6)
            ans += '</tr>'
        count += 1
    });
    return ans
}
