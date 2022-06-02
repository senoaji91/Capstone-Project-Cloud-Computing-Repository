const express = require("express");
//const multer = require("multer");
var fs = require("fs");

const app = express();

app.use(express.json());

// const fileStorageEngine = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, './images');
//     },
//     filename: (req, file, cb) => {
//         req.fileName=`${Date.now() + "--" + file.originalname}`; 
//         cb(null, req.fileName);
//     }
// });

//const uploadLocal = multer({ storage: fileStorageEngine })

// app.post('/single', uploadLocal.single('image'), (req, res) => {
//     console.log(req.file);
//     res.send("Single file uploadLocal successful");
// });

async function uploadLocal(base64Str,name) {
    fileName=name;
    fs.writeFile(`images/${fileName}`, base64Str, {encoding:'base64'}, function(err){
        if(err){
            console.log(err)
        }
        else{
            console.log("file created")
        }
    })
}

module.exports = uploadLocal