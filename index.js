

const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);



const  faqData = require("./data/faq.json")

//middleware
app.use(cors());
app.use(express.json());

app.post('/jwt', (req, res) => {
	const user = req.body;
	const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
		expiresIn: '1h',
	});

	res.send({ token });
});

//middleware function for verifying token
function verifyJWT(req, res, next) {
	const authorization = req.headers.authorization;
	console.log(authorization);
	if (!authorization) {
		return res.status(401).send({ error: 'Unauthorized access!' });
	}
	// step -2 . Verify if the provided token is valid or not.
	const token = authorization.split(' ')[1];
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		// console.log({ err });
		if (err) {
			return res.status(403).send({ error: 'Unauthorized access!' });
		}
		req.decoded = decoded;
		next();
	});
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oeh6vj2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		const usersCollection = client.db('lensCrafters').collection('users');
		const classesCollection = client.db('lensCrafters').collection('classes');
		const paymentCollection = client.db('lensCrafters').collection('payments');

		// verify jWt fot Admin
		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await usersCollection.findOne(query);
			if (user?.role !== 'admin') {
				return res
					.status(403)
					.send({ error: true, message: 'forbidden message' });
			}
			next();
		};

		// verify jWt fot Instructor
		const verifyInstructor = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await usersCollection.findOne(query);
			if (user?.role !== 'instructor') {
				return res
					.status(403)
					.send({ error: true, message: 'forbidden message' });
			}
			next();
		};

		// verify jWt fot student
		const verifyStudent = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await usersCollection.findOne(query);
			if (user?.role !== 'student') {
				return res
					.status(403)
					.send({ error: true, message: 'forbidden message' });
			}
			next();
		};
		// create payment intent
		app.post('/create-payment-intent', async (req, res) => {
			const { courseCost } = req.body;
			const amount = parseInt(courseCost * 100);
			const paymentIntent = await stripe.paymentIntents.create({
				amount: amount,
				currency: 'usd',
				payment_method_types: ['card'],
			});

			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});

		// app.post('/jwt', (req, res) => {
		// 	const user = req.body;
		// 	const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
		// 		expiresIn: '24h',
		// 	});

		// 	res.send({ token });
		// });

		// get all user
		app.get('/users', async (req, res) => {
			const result = await usersCollection.find().toArray();
			res.send(result);
		});
		// current user data
		app.get('/users/:email', async (req, res) => {
			const email = req.params.email;
			const query = { email: email }; // Creating a query object with the email field
			const result = await usersCollection.findOne(query);
			res.send(result);
		});

		// Save user email and role in DB during sign up
		app.post('/users', async (req, res) => {
			const user = req.body;
			console.log(user);

			const result = await usersCollection.insertOne(user);
			res.send(result);
		});

		// update role by admin
		app.put('/users', async (req, res) => {
			const user = req.body;
			const email = user.email;
			const filter = { email: email };
			console.log(filter);
			const updateDoc = {
				$set: { role: user.role },
			};
			console.log(updateDoc);
			const result = await usersCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		// Save google user email and role in DB
		app.post('/users/:email', async (req, res) => {
			const email = req.body.email;
			const query = { email: email };
			const user = req.body;
			try {
				const userData = await usersCollection.findOne(query);
				if (!userData) {
					// const updateDoc = {
					// 	user: user,
					// };
					const result = await usersCollection.insertOne(user);
					res.send(result);
				} else {
					return res.status(404).json({ message: 'User already registered!' });
				}
			} catch (error) {
				return res.status(500).json({ message: 'Internal server error' });
			}
		});

		// popular  classes + classes    (don't use verification)
		app.get('/classes', async (req, res) => {
			const query = { status: 'approved' };
			const result = await classesCollection
				.find(query)
				.sort({ booked: -1 })
				.toArray();
			res.send(result);
		});

		// admin
		app.get('/allClasses', async (req, res) => {
			const result = await classesCollection.find().toArray();
			res.send(result);
		});

		app.patch('/allClasses/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const body = req.body;
			const updatedData = {
				$set: {
					...(body?.status && { status: body.status }),
					...(body?.feedback && { feedback: body.feedback }),
				},
			};
			const result = await classesCollection.updateOne(query, updatedData);
			res.send(result);
		});

		// instructor (don't use verification)
		app.get('/instructors', async (req, res) => {
			const filter = { role: 'instructor' };
			const result = await usersCollection.find(filter).toArray();
			res.send(result);
		});

		// app.get('/instructors', async (req, res) => {
		// 	const result = await classesCollection
		// 		.find()
		// 		.sort({ booked: -1 })
		// 		.toArray();
		// 	res.send(result);
		// });

		// for each instructor to add a cls ***
		app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
			const doc = req.body;
			result = await classesCollection.insertOne(doc);
			res.send(result);
		});

		app.get(
			'/classes/:email',
			verifyJWT,
			verifyInstructor,
			async (req, res) => {
				const email = req.params.email;
				const query = { email: email }; // Creating a query object with the email field
				const result = await classesCollection.find(query).toArray();
				res.send(result);
			}
		);

		// student section
		app.get(
			'/bookedClasses/:email',
			// verifyJWT,
			// verifyStudent,
			async (req, res) => {
				const email = req.params.email;
				const user = await usersCollection.findOne({ email: email });
				console.log(user);
				if (user?.bookedClasses) {
					const bookedId = user.bookedClasses.map(
						(singleId) => new ObjectId(singleId)
					);
					const result = await classesCollection
						.find({ _id: { $in: bookedId } })
						.toArray();
					return res.send(result);
				}
				res.send([]);
			}
		);
		// booked a class by a student
		app.post('/bookClass', verifyJWT, verifyStudent, async (req, res) => {
			const { userId, classId } = req.body;
			console.log(classId);
			const filter = { _id: new ObjectId(userId) };
			const user = await usersCollection.findOne(filter);
			console.log(user);
			if (user) {
				if (!user.bookedClasses) {
					user.bookedClasses = [classId];
				} else {
					if (user.bookedClasses.includes(classId)) {
						return res.send({ error: true, message: 'Class already booked' });
					}

					user.bookedClasses.push(classId);
				}
				// Update the user in the database
				const updateDoc = { $set: user };
				const result = await usersCollection.updateOne(filter, updateDoc);
				return res.send(result);
				// return res.send({ message: 'Class booked successfully' });
			} else {
				return res.send({ message: 'User not found' });
			}
			res.send([]);
		});

		app.post('/deleteClass', async (req, res) => {
			const { userId, classId } = req.body;
			const filter = { _id: new ObjectId(userId) };
			const user = await usersCollection.findOne(filter);
			// Remove the class from the user's bookedClasses array
			user.bookedClasses = user.bookedClasses.filter((c) => c !== classId);
			// Update the user in the database
			const updateDoc = { $set: user };
			const result = await usersCollection.updateOne(filter, updateDoc);
			res.send(result);
			// return res.status(200).json({ message: 'Class deleted successfully' });
		});
		// after payment operation

		app.get('/payments/:email', async (req, res) => {
			const email = req.params.email;
			const query = { email: email };
			const result = await paymentCollection.find(query).toArray();
			res.send(result);
		});

		app.post('/payments', async (req, res) => {
			const payment = req.body;
			payment.date = new Date();
			const result = await paymentCollection.insertOne(payment);
			res.send(result);
		});
		app.post(
			'/updateClassData/:id',

			async (req, res) => {
				const id = req.params.id;

				const query = { _id: new ObjectId(id) };
				console.log(query);

				const classData = await classesCollection.findOne(query);
				console.log(classData);
				classData.booked = classData.booked + 1;
				classData.availableSeats = classData.availableSeats - 1;
				const updatedData = {
					$set: classData,
				};
				console.log(updatedData);
				const result = await classesCollection.updateOne(query, updatedData);
				res.send(result);
			}
		);

		// enrolled classes
		app.get(
			'/enrolledClasses/:email',

			async (req, res) => {
				const email = req.params.email;
				const query = { email: email };

				const result = await paymentCollection
					.find(query)
					.sort({ date: -1 })
					.toArray();

				res.send(result);
			}
		);

		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();
		// Send a ping to confirm a successful connection
		await client.db('admin').command({ ping: 1 });
		console.log(
			'Pinged your deployment. You successfully connected to MongoDB!'
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);





app.get('/faqs', (req, res) => {
	res.send(faqData);
  });

app.get('/', (req, res) => {
	res.send('lensCrafters is running ');
});

app.listen(port, () => {
	console.log('lensCrafters is running at port: ', port);
});
