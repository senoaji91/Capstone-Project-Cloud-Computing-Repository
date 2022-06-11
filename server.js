const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const { pool } = require("./dbConfig");
const jwt = require('jsonwebtoken');
const date = new Date();
const uploadLocal = require("./uploadLocal");
const uploadCloud = require("./uploadCloud");
const { fstat } = require('fs');
const spawn = require('child_process').spawn;
const fs = require("fs");

app.use(express.json({limit:'50mb'}))

//const users = []

// app.get('/users', async (req, res) => {
//     await pool.query(
//         `SELECT * FROM users`, 
//         (err, results)=>{
//             if (err) {
//                 throw err;
//             }
//             //console.log(results.rows)
//             const users = results.rows
//             res.json(users)
//         }
//     )
// })

// app.post('/users', async (req, res) => {
//   try {
//     const hashedPassword = await bcrypt.hash(req.body.password, 10)
//     const user = { name: req.body.name, password: hashedPassword }
//     users.push(user)
//     res.status(201).send()
//   } catch {
//     res.status(500).send()
//   }
// })

app.post("/register", async (req, res) => {
    let { name, email, password, password2 } = req.body;

    console.log({
        name,
        email,
        password,
        password2
    });

    let errors = [];

    if (!name || !email || !password || !password2){
        errors.push({ message: "Please enter all fields" });
    }

    if (password.length < 6) {
        errors.push({ message: "Password should be at least 6 characters" });
    }

    if (password != password2) {
        errors.push({ message: "Password do not match" });
    }

    if(errors.length > 0) {
        res.status(500).send({ errors });
    }else{
        let hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);

        await pool.query(
            `SELECT * FROM users 
            WHERE email = $1`, [email], (err, results)=>{
                if (err){
                    throw err;
                }

                console.log(results.rows);

                if(results.rows.length > 0){
                    errors.push({message: "Email already registered "});
                    res.status(500).send({ errors });
                }else{
                    pool.query(
                        `INSERT INTO users (name, email, password)
                        VALUES ($1, $2, $3)
                        RETURNING id, password`, [name, email, hashedPassword], 
                        (err, results)=>{
                            if (err) {
                                throw err;
                            }
                            console.log(results.rows);
                            res.status(201).send({message: "You are now registered. Please login"});
                        }
                    )
                }
            }
        )
    }
});

app.post('/login', async (req, res) => {
    pool.query(
        `SELECT * FROM users WHERE email =$1`, 
        [req.body.email],
        (err, results)=>{
            if (err) {
                throw err;
            }

            console.log(results.rows);

            if (results.rows.length > 0){
                const user = results.rows[0];

                bcrypt.compare(req.body.password, user.password, (err, isMatch)=>{
                    if(err){
                        throw err
                    }

                    if(isMatch){
                        const accessToken = generateAccessToken(user)
                        res.send({token: accessToken})
                    }else{
                        res.send({message: "Password incorrect"})
                    }
                });
            }else{
                res.status(400).send({message: "User not registered"});
            }
        }

    )
})

app.get('/dashboard', authenticateToken, (req, res) => {
    let results;
    pool.query(
        `SELECT * FROM recent_scan WHERE id = $1 ORDER BY scan_id DESC`, [req.user.id], 
        (err, results)=>{
            if (err) {
                throw err;
            }
            //console.log(results.rows);
            listHistoryFace = results.rows
           
            pool.query(
                `SELECT * FROM daily_treatment WHERE id = $1`, [req.user.id],
                (err, results)=>{
                    if (err) {
                        throw err;
                    }
                    listDailyTreatment = results.rows
                    res.status(201).send({id:req.user.id, name:req.user.name, email:req.user.email, password: req.user.password, listHistoryFace, listDailyTreatment});
                }
            )  
        }
    )
    //res.status(201).send({id:req.user.id, name:req.user.name, email:req.user.email, listHistoryFace:req.listHistoryFace});
})

// app.post('/upload', authenticateToken, async (req, res) => {
//     //console.log("upload");
//     //console.log(req.user);
//     //console.log(req.file);
//     if(!req.body.image){
//         res.send({ message: "Please enter image" });
//     } else {
//         req.fileName=`${Date.now() + ".jpg"}`;
//         await uploadLocal(`${req.body.image}`,`${req.fileName}`) 
//         console.log(`${req.fileName}`);
//         await uploadCloud(`./images/${req.fileName}`).catch(console.error);
//         req.imgLink= `https://storage.googleapis.com/skut_recent_scan/${req.fileName}`
    
//         pool.query(
//             `INSERT INTO recent_scan (id, img_link)
//             VALUES ($1, $2) RETURNING scan_id, timestamp, img_link`, [req.user.id, req.imgLink], 
//             (err, results)=>{
//                 if (err) {
//                     throw err;
//                 }
//                 console.log(results.rows);
//             }
//         )
//         res.send({ user: req.user, imgLink: req.imgLink });
//     }

// })

app.post('/upload', authenticateToken, async (req, res) => {
    if(!req.body.image){
        res.send({ message: "Please enter image" });
    } else {
        req.fileName=`${Date.now() + ".jpg"}`;
        await uploadLocal(`${req.body.image}`,`${req.fileName}`) 
        console.log(`${req.fileName}`);
        await uploadCloud(`./images/${req.fileName}`).catch(console.error);
        req.imgLink= `https://storage.googleapis.com/skut-bucket-1/${req.fileName}`   
        const python_process = spawn('python3', ['./python.py', req.imgLink]);
        python_process.stdout.on('data', (data) => {
            scan_result=JSON.parse(data.toString())
            console.log({ scan_result });
            pool.query(
                `INSERT INTO recent_scan (id, timestamp, img_link, acne, eksim, normal, rosacea)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING scan_id, timestamp, img_link`, [req.user.id, date.toLocaleString('en-GB'), req.imgLink, scan_result.acne, scan_result.eksim, scan_result.normal, scan_result.rosacea], 
                (err, results)=>{
                    if (err) {
                        throw err;
                    }
                    console.log(results.rows);
                }
            )
            fs.unlinkSync(`./images/${req.fileName}`)
            res.send({ user: req.user, imgLink: req.imgLink, scan_result });
        });
    }

})
//tes
//tes

app.delete('/upload', authenticateToken, (req, res) => {
    if (!req.body.scan_id || !req.user.id){
        res.send({ message: "Please enter scan_id" });
    } else {
        pool.query(
            `DELETE FROM recent_scan WHERE scan_id=$1 AND id=$2`, [req.body.scan_id, req.user.id], 
            (err, results)=>{
                if (err) {
                    throw err;
                }
                res.send({ message: `Scan id ${req.body.scan_id} deleted by ${req.user.name}` });
            }
        )
    }  
})

app.delete('/upload/reset', authenticateToken, (req, res) => {
    if (!req.user.id){
    } else {
        pool.query(
            `DELETE FROM recent_scan WHERE id=$1`, [ req.user.id], 
            (err, results)=>{
                if (err) {
                    throw err;
                }
                res.send({ message: `All recent scan data cleared by ${req.user.name}` });
            }
        )
    }  
})

app.post('/treatment', authenticateToken, async (req, res) => {
    //console.log("treatment");
    //console.log(req.user);
    //console.log(req.file);
    // req.fileName=`${Date.now() + ".jpg"}`;
    // await uploadLocal(`${req.body.image}`,`${req.fileName}`) 
    // console.log(`${req.fileName}`);
    // await uploadCloud(`./images/${req.fileName}`).catch(console.error);
    // req.product_image= `https://storage.googleapis.com/skut_recent_scan/${req.fileName}`

    if (!req.body.product_name || !req.body.time){
        res.send({ message: "Please enter product_name and time" });
    } else{
        pool.query(
            `INSERT INTO daily_treatment (id, product_name, time)
            VALUES ($1, $2, $3) RETURNING product_name, time, treatment_id`, [req.user.id, req.body.product_name, req.body.time], 
            (err, results)=>{
                if (err) {
                    throw err;
                }
                req.results=results.rows;
                res.send({ results: req.results });
            }
        )
    }
})

app.delete('/treatment', authenticateToken, (req, res) => {
    if (!req.body.treatment_id || !req.user.id){
        res.send({ message: "Please enter treatment_id" });
    } else {
        pool.query(
            `DELETE FROM daily_treatment WHERE treatment_id=$1 AND id=$2`, [req.body.treatment_id, req.user.id], 
            (err, results)=>{
                if (err) {
                    throw err;
                }
                res.send({ message: `Treatment id ${req.body.treatment_id} deleted by ${req.user.name}` });
            }
        )
    }
    
})

app.put('/treatment', authenticateToken, async (req, res) => {
    if (!req.body.treatment_id || !req.body.product_name || !req.body.time){
        res.send({ message: "Please enter treatment_id, product_name, and time" });
    } else {
        pool.query(
            `UPDATE daily_treatment SET product_name=$1, time=$2 WHERE treatment_id=$3 AND id=$4 RETURNING *`, [req.body.product_name, req.body.time, req.body.treatment_id, req.user.id], 
            (err, results)=>{
                if (err) {
                    throw err;
                }
                req.results=results.rows;
                res.send({ results: req.results});
            }
        )
    }
})

function generateAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30d' })
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return res.sendStatus(401)
  
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        //if (err) {console.log(err)}
        if (user) {console.log(user)}
        if (err) return res.sendStatus(403)
        req.user = user
        next()
    })
}

// function callPython (data_to_pass_in) {
//     console.log('Data sent:', data_to_pass_in);

//     const python_process = spawn('python', ['./python.py', data_to_pass_in]);

//     python_process.stdout.on('data', (data) => {
//         scan_result=JSON.parse(data.toString())
//         // console.log({ Acne:scan_result.Acne, Eksim:scan_result.Eksim });
//         return scan_result;
//     });
// }

app.listen(443, () => {
    console.log(`Server running on port 443`);
    console.log(date.toLocaleString('en-GB'));
});