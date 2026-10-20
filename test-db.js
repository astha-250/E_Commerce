const db = require("./db");

db.query("SELECT * FROM products", (err, results) => {

    if (err) {
        console.log("Query failed!");
        console.log(err.message);
    } 
    else {
        console.log("Products from database:");
        console.log(results);
    }

    db.end();
});