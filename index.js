const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000



app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ozrjf7g.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded
        next()
    });
}

async function run() {
    try {
        await client.connect();

        //  create database / / collection

        const productCollection = client.db('moto_db').collection('products')
        const orderCollection = client.db('moto_db').collection('orders')
        const userCollection = client.db('moto_db').collection('users')


        // get all the product to interface from database

        app.get('/product', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        })

        // get specified product details by id which was clicked by user

        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productCollection.findOne(query)
            res.send(result)
        })

        // insert ordered product to database on new datacollection

        app.post('/order', async (req, res,) => {
            const order = req.body
            const result = await orderCollection.insertOne(order)
            return res.send({ result });
        })

        // get users from UI 
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        // update / create user profile  when login or register 

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateUser = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateUser, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })


        // update data / / update product quantity after order done

        app.put('/updateProduct/:id', async (req, res) => {
            const id = req.params.id
            const product = req.body.newAvailableQty
            const query = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedProduct = {
                $set: {
                    availableQty: product
                }
            }
            const result = await productCollection.updateOne(query, updatedProduct, options)

            res.send(result)
        })


        app.get('/order', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const cursor = orderCollection.find(query);
                const orderedItems = await cursor.toArray()
                res.send(orderedItems);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

        });


    }
    finally {

    }
}
run().catch(console.dir)
app.get('/', (req, res) => {
    res.send('do you want to buy bike parts for your garage!')
})

app.listen(port, () => {
    console.log(`moto parts listening on port ${port}`)
})