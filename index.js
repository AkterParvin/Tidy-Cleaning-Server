const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const cookieParser = require('cookie-parser');

const app = express()
const port = process.env.port || 3000;



// middleware
app.use(cors({
    origin: [
        'https://food-and-taste-d6f3f.web.app',
        'https://food-and-taste-d6f3f.firebaseapp.com/?_gl=1*13zuaxi*_ga*OTI0OTAxMjM2LjE2OTc5MDU0MzQ.*_ga_CW55HF8NVT*MTY5OTQ0NjA4MC40LjEuMTY5OTQ1MDY3Ny40My4wLjA.',
        "http://localhost:5174"

    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.prs1keb.mongodb.net/tidyDB?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middlewares 
const logger = async (req, res, next) => {
    console.log('log Info:', req.method, req.originalUrl)
    next();
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized action' })
        }
        req.user = decoded;
        next();
    }
    )

}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const usersCollection = client.db('tidyDB').collection('users');
        const serviceCollection = client.db('tidyDB').collection('services');
        const bookingCollection = client.db('tidyDB').collection('bookings');

      

        // auth related CRUD 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user,
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: "12h" });

            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.ACCESS_TOKEN_SECRET === 'production',
                    sameSite: process.env.ACCESS_TOKEN_SECRET === 'production' ? 'none' : 'strict',
                    sameSite: 'none'
                })
                .send({ success: true });
        });


        app.post('/logout', async (req, res) => {
            const user = req.user;
            console.log('logging out user', user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true });
        })


        // userCollection read 
        app.get('/users', async (req, res) => {
            const cursor = usersCollection.find();
            const users = await cursor.toArray();
            res.send(users);
        })
        // app.get('/user/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) };
        //     const result = await userCollection.findOne(query);
        //     res.send(result);
        // })




        // user collection creat 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);

        })

        // service collection data
        app.get('/services', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            } else if (req.query.provider_email) {
                query = { provider_email: req.query.provider_email }
            }
            const result = await serviceCollection.find(query).toArray();

            res.send(result);
        })

        app.post('/services', async (req, res) => {
            const service = req.body;
            service.status = 'Pending';
            const result = await serviceCollection.insertOne(service);
            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.findOne(query);
            res.send(result);
        })

        app.delete('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.deleteOne(query);
            res.send(result);
        });

        app.put('/services/:id', async (req, res) => {
            const id = req.params.id;
            const updatedService = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const service = {
                $set: {
                    service_name: updatedService.service_name,
                    service_img: updatedService.service_img,
                    title: updatedService.title,
                    description: updatedService.description,
                    provider_name: updatedService.provider_name,
                    provider_email: updatedService.provider_email,
                    provider_img: updatedService.provider_img,
                    time: updatedService.time,
                    price: updatedService.price,
                    area: updatedService.area,
                    service_overview: updatedService.service_overview,
                    thumbnail: updatedService.thumbnail
                }
            };
            console.log(service)
            const result = await serviceCollection.updateOne(filter, service, options);
            res.send(result);

        })




        app.get('/bookings', verifyToken, async (req, res) => {
            console.log("Token owner info:", req.user);

            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            } else if (req.query.provider_email) {
                query = { provider_email: req.query.provider_email }
            }
            if (req.user.email !== req.query.email && req.user.email !== req.query.provider_email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        });

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateBooking = req.body;
            const updateDoc = {
                $set: {
                    status: updateBooking.status
                },
            }
            console.log(updateBooking);
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Tidy Aid Server side is running on port!')
})

app.listen(port, () => {
    console.log(`Tidy Cleaning Aid listening on port ${port}`)
})

