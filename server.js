const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const { pool } = require("./dbConfig");
const jwt = require('jsonwebtoken');
const date = new Date();
const uploadLocal = require("./uploadLocal");
const uploadCloud = require("./uploadCloud");


app.use(express.json({limit:'50mb'}))

const users = []

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


app.post("/upload", authenticateToken, async (req, res) => {
    console.log("upload");
    console.log(req.user);
    //console.log(req.file);
    req.fileName=`${Date.now() + ".jpg"}`;
    uploadLocal(`${req.body.image}`,`${req.fileName}`) 
    console.log(`${req.fileName}`);
    await uploadCloud(`./images/${req.fileName}`).catch(console.error);
    req.imgLink= `https://storage.googleapis.com/skut_recent_scan/${req.fileName}`

    pool.query(
        `INSERT INTO recent_scan (id, img_link)
        VALUES ($1, $2) RETURNING scan_id, timestamp, img_link`, [req.user.id, req.imgLink], 
        (err, results)=>{
            if (err) {
                throw err;
            }
            console.log(results.rows);
        }
    )
    res.send({ user: req.user, imgLink: req.imgLink });
})

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
                            res.status(201).send("You are now registered. Please login");
                        }
                    )
                }
            }
        )
    }
});

// app.post('/users/login', async (req, res) => {
//   const user = users.find(user => user.name === req.body.name)
//   if (user == null) {
//     return res.status(400).send('Cannot find user')
//   }
//   try {
//     if(await bcrypt.compare(req.body.password, user.password)) {
//        res.send('Success')
//     } else {
//        res.send('Not Allowed')
//     }
//   } catch {
//      res.status(500).send()
//   }
// })

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
                        res.send(accessToken)
                    }else{
                        res.send('Not Allowed')
                    }
                });
            }else{
                res.status(400).send('Cannot find user');
            }
        }

    )
})

app.get('/dashboard', authenticateToken, (req, res) => {
    pool.query(
        `SELECT * FROM recent_scan WHERE id = $1`, [req.user.id], 
        (err, results)=>{
            if (err) {
                throw err;
            }
            //console.log(results.rows);
            res.status(201).send({id:req.user.id, name:req.user.name, email:req.user.email, password: req.user.password, listHistoryFace: results.rows});
        }
    )
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

app.listen(8080, () => {
    console.log(`Server running on port 8080`);
    console.log(date.toLocaleString('uk'));
});