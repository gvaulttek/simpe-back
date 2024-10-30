const express = require("express");
let cors = require('cors');
const app = express();
app.use(cors());
const {allCombination} = require('./combinations');
// const {project, menu, forbidden} = require('./data');
app.use(express.json({limit:'200mb'}));

app.put("/", function(req,res){
    if (!req.body) return res.sendStatus(400);
    let project = req.body.project;
    let menu = req.body.menu;
    let forbidden = req.body.forbs;
    let data = allCombination(project,menu,forbidden)
    res.send(data);
});

app.listen(3000);