const express = require('express')
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors());
app.use(express.json());




// const uri = `mongodb+srv://test:test1234@cluster0.gnkxs.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1tedy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized Access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden Access' })
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {

  try {
    await client.connect();
    // Getting the data from database
    const slotCollection = client.db("doctorsPortal").collection("slotBooking");
    const bookingCollection = client.db("doctorsPortal").collection("userBooking");

    const userCollection = client.db("doctorsPortal").collection("users");


    // Delete a particuller user 
    app.delete('/deleteSlot/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })

    // Insert a new user to the database. 

    app.put(`/user/:email`, async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: user
      }
      const result = await userCollection.updateOne(filter, updateDoc, option);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
      res.send({ result, token });
    })


    // update a user as admin. 
    app.put(`/user/admin/:email`, verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email; 
      const requesterAccount = await userCollection.findOne({email: requester});  
      if(requesterAccount.role === 'admin'){
        const filter = { email: email };
      const updateDoc = {
        $set: {role: 'admin'}
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      // const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
      res.send( result);
      }
      else{
        res.status(403).send({message: 'Forbidden'}); 
      }
      
    }); 


    // Only admin can see all user at the UI  
    app.get('/admin/:email', async (req, res)=>{
      const email = req.params.email; 
      const getResult = await userCollection.findOne({email: email}); 
      console.log(getResult.role); 
      if(getResult.role === 'admin'){
        res.status(200).send(getResult); 
      }
      else{
        res.status(403).send({message: 'You are not admin'}); 
      }
    })




    app.get('/services', async (req, res) => {
      const query = {};
      const cursor = slotCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    // Get a particuler booking according to email
    app.get('/bookings', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const booking = await bookingCollection.find(query).toArray();
        return res.send(booking);
      }
      else{
        return res.status(403).send({message: 'Forbidden Access'})
      }
    })

    // Add a booking to the database. 
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { name: booking?.name, bookingDate: booking?.bookingDate, email: booking?.email };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      else {
        const result = await bookingCollection.insertOne(booking);
        res.send({ success: true, result });
      }
    });


    app.get('/available', async (req, res) => {
      const bookingDate = req.query.date || 'May 15, 2022';

      // step 1 get all the data; 
      const services = await slotCollection.find().toArray();

      // set 2 get the booking of that day; 
      const query = { bookingDate: bookingDate };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3
      services.forEach(service => {
        const servicesBookings = bookings.filter(booking => booking.name === service.name);
        const booked = servicesBookings.map(book => book.slot);
        const available = service.slots.filter(bookedService => !booked.includes(bookedService));
        service.slots = available;
      })
      res.send(services);

    })

    // Get all the users from database. 

    app.get('/alluser', verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray(); 
      res.send(result); 
    }); 


    // Delete a particular user from all user 

    app.delete('/deleteUser/:id', async (req, res) => {
      const id = req.params.id; 
      const query = {_id:ObjectId(id)}; 
      const result = await userCollection.deleteOne(query); 
      console.log(query); 
      res.send(result); 
    }); 




    // Get the name for query
    app.get('/servicesforadd', async (req, res) => {
      const query = {};
      const cursor = slotCollection.find(query).project({name: 1});
      const services = await cursor.toArray();
      res.send(services);
    });


  }
  finally {

  }
}
run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Doctors portal is running as server')
})

app.listen(port, () => {
  console.log('Listening to the port for doctors portal', port)
})