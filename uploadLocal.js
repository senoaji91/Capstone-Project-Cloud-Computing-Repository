const express = require("express");
const multer = require("multer");

const app = express();

app.use(express.json());

const fileStorageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './images');
    },
    filename: (req, file, cb) => {
        req.fileName=`${Date.now() + "--" + file.originalname}`; 
        cb(null, req.fileName);
    }
});

const uploadLocal = multer({ storage: fileStorageEngine })

// app.post('/single', uploadLocal.single('image'), (req, res) => {
//     console.log(req.file);
//     res.send("Single file uploadLocal successful");
// });

module.exports = uploadLocal