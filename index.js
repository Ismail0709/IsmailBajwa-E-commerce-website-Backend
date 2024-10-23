const PORT = 8000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { type } = require("os");
const { error } = require("console");

app.use(express.json());
app.use(cors());

const SECRET_KEY = 'BJ_STORE_SECRET_KEY'


//Database connection with MongoDB

const dbURI = "mongodb+srv://Bajwa:bajwa2003@bj-store-cluster.zay3qp4.mongodb.net/?retryWrites=true&w=majority&appName=BJ-Store-Cluster"

mongoose.connect(dbURI);

//API Creation 

app.get("/", (req, res)=>{
    res.send("Express Server is running");
});

//Image storage engine
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb)=>{
        const uniqueSuffix = `${Date.now()}${path.extname(file.originalname)}`; // Get original file extension
        const newFilename = `product_${uniqueSuffix}`;
        cb(null, newFilename);

        //return cb(null, `product_${file.filename}_${Date.now()}${path.extname(file.originalname)}`);
    }
});  

const upload = multer({storage: storage});

//Creating Upload Endpoint for images

app.use('/images', express.static('upload/images'));

app.post("/upload", upload.single('product'), (req, res)=>{
    res.json({
        success: 1,
        image_url: `http://localhost:${PORT}/images/${req.file.filename}`
    });
});

//Schema for creating products

const Product = mongoose.model("Product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    },
});

app.post("/addProduct", async (req, res)=>{

    let products = await Product.find({});
    let id;
    if (products.length > 0){
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id + 1;
    }else{
        id = 1;
    }

    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("Saved!!");
    res.json({
        success: true,
        name: req.body.name,
    });
});


app.post("/removeProduct", async(req, res)=>{
    await Product.findOneAndDelete({id: req.body.id});
    console.log("Product Removed");
    res.json({
        success: true,
        name: req.body.name
    })
});

app.get("/allProducts", async(req, res)=>{
    let products = await Product.find({});
    console.log("All products fetched!!");
    res.send(products);
})

const Users = mongoose.model('User', {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now()
    }
})

app.post('/signup', async (req, res)=>{
    let check = await Users.findOne({email: req.body.email})

    if(check){
        return res.status(400).json({success: false, error: 'User alreaddy exists'})
    }
    let cart = {};
    for(let i=0; i<300; i++){
        cart[i] = 0;
    }

    const user = new Users({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        cartData: cart
    });

    await user.save();

    const data = {
        user: {
            id: user.id
        }
    }

    

    let token = jwt.sign(data, SECRET_KEY);
    res.json({success: true, token});

})


app.post('/login', async (req, res)=>{
    let user = await Users.findOne({email: req.body.email});

    if(user){
        const authorized = req.body.password === user.password;
        if(authorized){
            const data = {
                user: {
                    id: user.id
                }
            }
            const token = jwt.sign(data, SECRET_KEY);
            res.json({success: true, token});
        }
    }else{
        res.json({success: false, error: "Invalid Email or password"});
    }
})

app.get('/newCollections', async(req, res)=>{
    let products = await Product.find({});
    let newCollection = products.slice(1).slice(-8);
    console.log('New Collection Fetched');
    res.send(newCollection);
});

app.get('/popularInWomen', async(req, res)=>{
    let products = await Product.find({category: 'women'});
    popular_in_women = products.slice(0,4);
    console.log('Popular in Women Fetched');
    res.send(popular_in_women);
})

const fetchUser = async(req, res, next)=> {
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({error: "Unauthorized"});
    }else{
        try {
            const data = jwt(token, SECRET_KEY);
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({error: 'Authenticate using valid token'});
        }
    }
}

app.post('/addToCart', fetchUser, async(req, res)=>{
    console.log("Removed", req.body.itemID);
    let userData = await Users.findOne({_id: req.user.id});
    userData.cartData[req.body.itemID] =+ 1;

    await Users.findOneAndUpdate({_id: req.user.id, cartData: userData.cartData});
    res.send("Added");
});

app.post('/removeFromCart', fetchUser, async(req, res)=>{
    console.log("Removed", req.body.itemID);
    let userData = await Users.findOne({_id: req.user.id});
    if(userData.cartData[req.body.itemID] > 0){
        userData.cartData[req.body.itemID] =- 1;
    }
    
    await Users.findOneAndUpdate({_id: req.user.id, cartData: userData.cartData});
    res.send("Removed");
})

app.post('getCart', fetchUser, async(req, res)=>{
    console.log("Get Cart");
    let userData = await Users.findOne({_id: req.user.id});
    res.json(userData.cartData);
})

app.listen(PORT, (error)=>{
    if(!error){
        console.log(`Server is successfully running on port ${PORT}`);
    }else{
        console.log("Error: " +error);
    }
})