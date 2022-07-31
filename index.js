const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
        const paymentCollection = client.db('moto_db').collection('payments')


        // get all the product to interface from database

        app.get('/product', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        })
        // post  product to  database

        app.post('/product', async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
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
        // get admin from UI 
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user?.role === 'admin'
            res.send({ admin: isAdmin });
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
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })
            res.send({ result, token });
        })


        // Delete a user from ui

        app.delete('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await userCollection.deleteOne(filter);
            res.send(result);
        })
        // Delete a order from ui

        app.delete('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        })




        //  update user to admin role


        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const manager = req.decoded.email;
            const managerAccount = await userCollection.findOne({ email: manager });
            if (managerAccount.role === 'admin') {
                const filter = { email: email };
                const updateUser = {
                    $set: { role: 'admin' },
                }
                const result = await userCollection.updateOne(filter, updateUser);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbiddedn access' })
            }

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
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order)


        });

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const product = req.body;
            const price = product.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({ clientSecret: paymentIntent.client_secret })

        })

        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    payment: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        })




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