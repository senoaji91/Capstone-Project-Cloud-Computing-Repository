const express = require("express");
const app = express();
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const date = new Date();
const uploadLocal = require("./uploadLocal");
const uploadCloud = require("./uploadCloud");
const initializePassport = require("./passportConfig");

initializePassport(passport);

const PORT = process.env.PORT || 5000;

app.set("view engine", "ejs");
//app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.use(
    session({
        secret: 'secret',
    
        resave: false,

        saveUninitialized: false
    })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/register", checkAuthenticated, (req, res) => {
    res.render("register");
})

app.get("/login", checkAuthenticated, (req, res) => {
    res.render("login");
})

app.get("/dashboard", checkNotAuthenticated, (req, res) => {
    console.log(req.user);
    res.send({ user: req.user });
})

//upload gambar hasil scan
app.post("/upload", checkNotAuthenticated, uploadLocal.single('image'), (req, res) => {
    console.log("upload");
    console.log(req.user);
    console.log(req.file);
    console.log(`${req.fileName}`);
    uploadCloud(`./images/${req.fileName}`).catch(console.error);
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

app.get("/recent", checkNotAuthenticated, (req, res) => {
    pool.query(
        `SELECT * FROM recent_scan WHERE id = $1`, [req.user.id], 
        (err, results)=>{
            if (err) {
                throw err;
            }
            console.log(results.rows);
            res.send(results.rows);
        }
    )
})

app.get("/logout", (req, res) => {
    req.logOut();
    req.flash("success_msg", "You have logged out");
    res.redirect("/login");
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
        res.render("register", { errors });
    }else{
        let hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);

        pool.query(
            `SELECT * FROM users 
            WHERE email = $1`, [email], (err, results)=>{
                if (err){
                    throw err;
                }

                console.log(results.rows);

                if(results.rows.length > 0){
                    errors.push({message: "Email already registered "});
                    res.render("register", { errors });
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
                            req.flash("success_msg", "You are now registered. Please login");
                            res.redirect("/login");
                        }
                    )
                }
            }
        )
    }
});

app.post("/login", passport.authenticate('local', {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true
}));

app.use((req, res, next) => {
    res.send("404 - page not found");
});

function checkAuthenticated(req, res, next){
    if (req.isAuthenticated()){
        return res.redirect("/dashboard");
    }
    next();
}

function checkNotAuthenticated(req, res, next){
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

function storeRecent(req, res, next){
    console.log('recent scan SQL query performed');
    return next();
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(date.toLocaleString('uk'));
});