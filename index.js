const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

function generateTrackingId() {
  const prefix = "STYL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}

const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tadlde2.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("styleDecor");

    const usersCollection = db.collection("users");
    const servicesCollection = db.collection("services");
    const bookingsCollection = db.collection("bookings");
    const decoratorsCollection = db.collection("decorators");
    const paymentsCollection = db.collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const user = await usersCollection.findOne({ email });
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    const verifyDecorator = async (req, res, next) => {
      const email = req.decoded_email;
      const user = await usersCollection.findOne({ email });
      if (!user || user.role !== "decorator") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();

      const exists = await usersCollection.findOne({ email: user.email });
      if (exists) {
        return res.send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const searchText = req.query.searchText;
      const query = {};

      if (searchText) {
        const regex = { $regex: searchText, $options: "i" };
        query.$or = [{ displayName: regex }, { email: regex }];
      }

      const cursor = usersCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(10);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.patch("/users/:id/role", verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role } };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.get("/users/:email/role", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded_email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const user = await usersCollection.findOne({ email });
      res.send({ role: user?.role || "user" });
    });

    app.get("/services", async (req, res) => {
      const { name, type, minBudget, maxBudget } = req.query;
      const query = {};
      if (name) {
        query.service_name = { $regex: name, $options: "i" };
      }
      if (type) {
        query.service_category = type;
      }
      if (minBudget || maxBudget) {
        query.cost = {};
        if (minBudget) query.cost.$gte = Number(minBudget);
        if (maxBudget) query.cost.$lte = Number(maxBudget);
      }
      const cursor = servicesCollection.find(query).sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.findOne(query);
      res.send(result);
    });

    app.post("/services", verifyJWT, verifyAdmin, async (req, res) => {
      const service = req.body;
      service.createdAt = new Date();
      const result = await servicesCollection.insertOne(service);
      res.send(result);
    });

    app.patch("/services/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: updateData };
      const result = await servicesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.delete("/services/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/decorators", verifyJWT, verifyAdmin, async (req, res) => {
      const decorator = req.body;
      decorator.createdAt = new Date();
      decorator.status = "active";
      decorator.earnings = 0;
      const result = await decoratorsCollection.insertOne(decorator);
      res.send(result);
    });

    app.get("/decorators", async (req, res) => {
      const { name, specialty } = req.query;
      const query = { status: "active" };

      if (name) query.name = { $regex: name, $options: "i" };
      if (specialty) query.specialty = specialty;

      const cursor = decoratorsCollection
        .find(query)
        .sort({ rating: -1, createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get(
      "/decorator/bookings",
      verifyJWT,
      verifyDecorator,
      async (req, res) => {
        const email = req.decoded_email;
        const query = { decoratorEmail: email };
        const cursor = bookingsCollection.find(query).sort({ eventDate: 1 });
        const result = await cursor.toArray();
        res.send(result);
      }
    );

    app.patch(
      "/decorator/bookings/:id/status",
      verifyJWT,
      verifyDecorator,
      async (req, res) => {
        const id = req.params.id;
        const { status } = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status } };
        const result = await bookingsCollection.updateOne(query, updateDoc);
        res.send(result);
      }
    );

    app.post("/bookings", verifyJWT, async (req, res) => {
      const booking = req.body;
      booking.createdAt = new Date();
      booking.status = "pending_payment";
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const { status, sortBy } = req.query;
      const query = {};

      if (email) query.userEmail = email;
      if (status) query.status = status;

      let cursor = bookingsCollection.find(query);

      if (sortBy === "date") {
        cursor = cursor.sort({ eventDate: -1 });
      } else if (sortBy === "status") {
        cursor = cursor.sort({ status: 1 });
      } else {
        cursor = cursor.sort({ createdAt: -1 });
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    app.patch("/bookings/:id/cancel", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status: "cancelled" } };
      const result = await bookingsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch(
      "/bookings/:id/assign",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { decoratorId, decoratorName, decoratorEmail } = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            decoratorId,
            decoratorName,
            decoratorEmail,
            status: "assigned",
          },
        };
        const result = await bookingsCollection.updateOne(query, updateDoc);
        res.send(result);
      }
    );

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged deployment. Connected to MongoDB.");
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("StyleDecor Server Running");
});

app.listen(port, () => {
  console.log(`StyleDecor server listening on port ${port}`);
});
