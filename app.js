const express = require("express");
let compression = require('compression')
let cors = require('cors');
const app = express();
app.use(cors());
app.use(compression());
const {allCombination} = require('./combinations');
app.use(express.json({limit:'200mb'}));

app.post("/", function(req,res){
    if (!req.body) return res.sendStatus(400);
    let project = req.body.project;
    let menu = req.body.menu;
    let forbidden = req.body.forbs;
    let data = allCombination(project,menu,forbidden);
    res.send(data);
});

app.listen(3000);