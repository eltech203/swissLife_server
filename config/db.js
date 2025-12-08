const mysql = require("mysql");
const util = require("util");
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "test_swisslife_db"
});

//Create a Connection to Database

db.connect((err)=>{
    if(err!=null){
        console.log('No Connect to database')
        
    }else{
        console.log('💾 Connect to database')
    }
    
})
// Promisify for async/await
db.query = util.promisify(db.query);
module.exports = db;



