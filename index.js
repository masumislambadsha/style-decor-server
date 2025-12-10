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
app.use(cors());

function generateTrackingId() {
  const prefix = "STYL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.decoded_email = decoded.email;
    req.decoded_role = decoded.role;
    next();
  } catch (err) {
    console.error("JWT verification error:", err.message);
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
    const db = client.db("styleDecor");
    const usersCollection = db.collection("users");
    const servicesCollection = db.collection("services");
    const bookingsCollection = db.collection("bookings");
    const decoratorsCollection = db.collection("decorators");
    const paymentsCollection = db.collection("payments");
    const decoratorApplicationsCollection = db.collection(
      "decoratorApplications"
    );


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

    // jwt token
    app.post("/jwt", async (req, res) => {
      try {
        const { email } = req.body;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const token = jwt.sign(
          {
            email: user.email,
            role: user.role || "user",
            name: user.name || user.displayName || "User",
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        res.send({
          token,
          user: {
            email: user.email,
            role: user.role || "user",
            name: user.name || user.displayName,
          },
        });
      } catch (err) {
        console.error("JWT generation error:", err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // USER RELATED APIs

    // create user api
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;

        const exists = await usersCollection.findOne({ email: user.email });

        if (exists) {
          const result = await usersCollection.updateOne(
            { email: user.email },
            {
              $set: {
                name: user.name,
                photoURL: user.photoURL,
              },
            }
          );

          return res.send({
            message: "User updated",
            modifiedCount: result.modifiedCount,
          });
        }

        const newUser = {
          ...user,
          role: "user",
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        res.send({
          message: "User created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("User creation error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // get user api
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const searchText = req.query.searchText;
        const query = {};

        if (searchText) {
          const regex = { $regex: searchText, $options: "i" };
          query.$or = [
            { displayName: regex },
            { name: regex },
            { email: regex },
          ];
        }

        const cursor = usersCollection
          .find(query)
          .sort({ createdAt: -1 })
          .limit(10);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Get users error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // update user role api
    app.patch("/users/:id/role", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;

        if (!["admin", "user", "decorator"].includes(role)) {
          return res.status(400).send({ message: "Invalid role" });
        }

        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role } };
        const result = await usersCollection.updateOne(query, updateDoc);

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({
          message: "Role updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Update role error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // ADMIN RELATED APIs

    // analytics api
    app.get("/admin/analytics", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const revenueAgg = await paymentsCollection
          .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
          .toArray();

        const serviceDemand = await bookingsCollection
          .aggregate([
            {
              $addFields: {
                serviceObjectId: {
                  $convert: {
                    input: "$serviceId",
                    to: "objectId",
                    onError: null,
                  },
                },
              },
            },
            {
              $group: {
                _id: "$serviceObjectId",
                count: { $sum: 1 },
              },
            },
            {
              $lookup: {
                from: "services",
                localField: "_id",
                foreignField: "_id",
                as: "service",
              },
            },
            { $unwind: "$service" },
            {
              $project: {
                _id: 1,
                count: 1,
                service_name: "$service.service_name",
              },
            },
            { $sort: { count: -1 } },
          ])
          .toArray();

        const totalUsers = await usersCollection.countDocuments();
        const totalBookings = await bookingsCollection.countDocuments();

        res.send({
          totalRevenue: revenueAgg[0]?.total || 0,
          serviceDemand,
          totalUsers,
          totalBookings,
        });
      } catch (error) {
        console.error("Analytics error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // get user role api
    app.get("/users/:email/role", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;

        if (email !== req.decoded_email && req.decoded_role !== "admin") {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const user = await usersCollection.findOne({ email });
        res.send({
          role: user?.role || "user",
          email: user?.email,
          name: user?.name || user?.displayName,
        });
      } catch (error) {
        console.error("Get role error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // delete decorator
    app.delete("/decorators/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid decorator ID" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await decoratorsCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Decorator not found" });
        }

        res.send({
          message: "Decorator deleted successfully",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error("Delete decorator error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // SERVICES APIs

    // get services api
    app.get("/services", async (req, res) => {
      try {
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
      } catch (error) {
        console.error("Get services error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // get single service api
    app.get("/services/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid service ID" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await servicesCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "Service not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Get single service error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // create service api
    app.post("/services", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const service = req.body;
        service.createdAt = new Date();
        service.isActive = true;

        const result = await servicesCollection.insertOne(service);
        res.send({
          message: "Service created successfully",
          insertedId: result.insertedId,
          service,
        });
      } catch (error) {
        console.error("Create service error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // update service details api
    app.patch("/services/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid service ID" });
        }

        const updateData = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: updateData };

        const result = await servicesCollection.updateOne(query, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Service not found" });
        }

        res.send({
          message: "Service updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Update service error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // delete service api
    app.delete("/services/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid service ID" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await servicesCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Service not found" });
        }

        res.send({
          message: "Service deleted successfully",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error("Delete service error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // DECORATOR RELATED APIs

    // user submits decorator application
    app.post("/decorator-applications", verifyJWT, async (req, res) => {
      try {
        const data = req.body;

        if (data.email !== req.decoded_email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const payload = {
          name: data.name,
          email: data.email,
          photoURL: data.photoURL || null,
          phone: data.phone,
          city: data.city,
          specialty: data.specialty,
          experienceYears: Number(data.experienceYears) || 0,
          portfolioUrl: data.portfolioUrl || null,
          bio: data.bio,
          availability: data.availability,
          agreedToTerms: !!data.agreedToTerms,
          status: "pending",
          createdAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
        };

        const existing = await decoratorApplicationsCollection.findOne({
          email: payload.email,
          status: { $in: ["pending", "approved"] },
        });
        if (existing && existing.status === "pending") {
          return res
            .status(409)
            .send({ message: "You already have a pending application" });
        }

        const result = await decoratorApplicationsCollection.insertOne(payload);

        res.send({
          message: "Application submitted successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Create decorator application error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    //get decorator applications
    app.get("/decorator-applications",verifyJWT,verifyAdmin,async (req, res) => {
        try {
          const status = req.query.status;
          const query = {};
          if (status) query.status = status;

          const cursor = decoratorApplicationsCollection
            .find(query)
            .sort({ createdAt: -1 });
          const result = await cursor.toArray();
          res.send(result);
        } catch (error) {
          console.error("Get decorator applications error:", error);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    // update(accept/reject) decorator application
    app.patch("/decorator-applications/:id/review",verifyJWT,verifyAdmin,async (req, res) => {
        try {
          const { id } = req.params;
          const { action } = req.body;

          if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid application ID" });
          }
          if (!["approve", "reject"].includes(action)) {
            return res.status(400).send({ message: "Invalid action" });
          }

          const appDoc = await decoratorApplicationsCollection.findOne({
            _id: new ObjectId(id),
          });
          if (!appDoc) {
            return res.status(404).send({ message: "Application not found" });
          }

          const newStatus = action === "approve" ? "approved" : "rejected";
          await decoratorApplicationsCollection.updateOne(
            { _id: appDoc._id },
            {
              $set: {
                status: newStatus,
                reviewedAt: new Date(),
                reviewedBy: req.decoded_email,
              },
            }
          );

          if (action === "reject") {
            return res.send({ message: "Application rejected" });
          }
          await usersCollection.updateOne(
            { email: appDoc.email },
            { $set: { role: "decorator" } }
          );

          await decoratorsCollection.updateOne(
            { email: appDoc.email },
            {
              $set: {
                name: appDoc.name,
                email: appDoc.email,
                photoURL: appDoc.photoURL || null,
                phone: appDoc.phone,
                city: appDoc.city,
                specialty: appDoc.specialty,
                bio: appDoc.bio,
                availability: appDoc.availability,
                status: "active",
              },
              $setOnInsert: {
                createdAt: new Date(),
                earnings: 0,
                rating: 5,
              },
            },
            { upsert: true }
          );

          res.send({ message: "Application approved and decorator created" });
        } catch (error) {
          console.error("Review decorator application error:", error);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    // get decorators api
    app.get("/decorators", async (req, res) => {
      try {
        const { name, specialty } = req.query;
        const query = { status: "active" };

        if (name) query.name = { $regex: name, $options: "i" };
        if (specialty) query.specialty = specialty;

        const cursor = decoratorsCollection
          .find(query)
          .sort({ rating: -1, createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Get decorators error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // get assigned bookings
    app.get("/decorator/bookings",verifyJWT,verifyDecorator,
      async (req, res) => {
        try {
          const email = req.decoded_email;
          const query = { decoratorEmail: email };
          const cursor = bookingsCollection.find(query).sort({ createdAt: -1 });
          const result = await cursor.toArray();
          res.send(result);
        } catch (error) {
          console.error("Get decorator bookings error:", error);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    // BOOKING RELATED APIs

    // get bookings api
    app.get("/bookings", verifyJWT, async (req, res) => {
      try {
        const email = req.query.email;
        const { status, sortBy } = req.query;
        const query = {};

        if (
          email &&
          email !== req.decoded_email &&
          req.decoded_role !== "admin"
        ) {
          return res.status(403).send({ message: "Forbidden access" });
        }

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
      } catch (error) {
        console.error("Get bookings error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // create booking api
    app.post("/bookings", verifyJWT, async (req, res) => {
      try {
        const booking = req.body;

        if (
          booking.userEmail !== req.decoded_email &&
          req.decoded_role !== "admin"
        ) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        booking.createdAt = new Date();
        booking.status = "pending_payment";
        booking.paymentStatus = "pending";

        const result = await bookingsCollection.insertOne(booking);
        res.send({
          message: "Booking created successfully",
          insertedId: result.insertedId,
          booking,
        });
      } catch (error) {
        console.error("Create booking error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // update booking status api
    app.patch("/bookings/:id/cancel", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid booking ID" });
        }

        const query = { _id: new ObjectId(id) };

        const booking = await bookingsCollection.findOne(query);
        if (!booking) {
          return res.status(404).send({ message: "Booking not found" });
        }

        if (
          booking.userEmail !== req.decoded_email &&
          req.decoded_role !== "admin"
        ) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const updateDoc = { $set: { status: "cancelled" } };
        const result = await bookingsCollection.updateOne(query, updateDoc);

        res.send({
          message: "Booking cancelled successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Cancel booking error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // update to assigned to a decoraotr api
    app.patch("/bookings/:id/assign",verifyJWT,verifyAdmin,async (req, res) => {
        try {
          const id = req.params.id;
          if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid booking ID" });
          }

          const { decoratorId, decoratorName, decoratorEmail } = req.body;

          if (!decoratorEmail || !decoratorName) {
            return res
              .status(400)
              .send({ message: "Decorator details required" });
          }

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

          if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Booking not found" });
          }

          res.send({
            message: "Decorator assigned successfully",
            modifiedCount: result.modifiedCount,
          });
        } catch (error) {
          console.error("Assign decorator error:", error);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    //  update booking status
    app.patch("/bookings/:id/status", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid booking ID" });
        }

        const allowed = [
          "assigned",
          "planning",
          "materials_prepared",
          "on_the_way",
          "setup_in_progress",
          "completed",
          "cancelled",
        ];

        if (!allowed.includes(status)) {
          return res.status(400).send({ message: "Invalid status" });
        }

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Booking not found" });
        }

        res.send({
          message: "Status updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Update booking status error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // PAYMENTS RELATED APIs

    app.post("/create-checkout-session", verifyJWT, async (req, res) => {
      try {
        const paymentInfo = req.body;

        if (paymentInfo.userEmail !== req.decoded_email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(paymentInfo.bookingId),
        });

        if (!booking) {
          return res.status(404).send({ message: "Booking not found" });
        }

        const cost = paymentInfo.cost ?? booking.cost ?? 0;
        const amount = Math.round(Number(cost) * 100);

        if (!Number.isFinite(amount) || amount <= 0) {
          return res
            .status(400)
            .send({ message: "Invalid amount for this booking" });
        }

        if (amount > 99999999) {
          return res.status(400).send({
            message:
              "Amount too large for online payment. Please contact support.",
          });
        }

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amount,
                product_data: {
                  name: paymentInfo.serviceName || booking.serviceName,
                },
              },
              quantity: 1,
            },
          ],
          metadata: {
            bookingId: booking._id.toString(),
            serviceName: paymentInfo.serviceName || booking.serviceName,
            userEmail: paymentInfo.userEmail,
          },
          mode: "payment",
          customer_email: paymentInfo.userEmail,
          success_url: `${
            process.env.SITE_DOMAIN || "https://style-decor-5b2fb.web.app"
          }/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${
            process.env.SITE_DOMAIN || "https://style-decor-5b2fb.web.app"
          }/dashboard/payment-cancelled`,
        });

        res.send({ url: session.url });
      } catch (error) {
        console.error("Stripe session error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    app.patch("/payment-success", async (req, res) => {
      try {
        const sessionId = req.query.session_id;

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const transactionId = session.payment_intent;

        const exists = await paymentsCollection.findOne({ transactionId });
        if (exists) {
          return res.send({
            message: "Already paid",
            transactionId,
            trackingId: exists.trackingId,
            success: true,
          });
        }

        const trackingId = generateTrackingId();

        if (session.payment_status === "paid") {
          const bookingId = session.metadata.bookingId;
          const query = { _id: new ObjectId(bookingId) };
          const update = {
            $set: {
              paymentStatus: "paid",
              status: "assigned_pending",
              trackingId: trackingId,
            },
          };

          await bookingsCollection.updateOne(query, update);

          const payment = {
            amount: session.amount_total / 100,
            currency: session.currency,
            customerEmail: session.customer_email,
            bookingId: session.metadata.bookingId,
            serviceName: session.metadata.serviceName,
            transactionId: transactionId,
            paymentStatus: session.payment_status,
            paidAt: new Date(),
            trackingId: trackingId,
          };

          await paymentsCollection.insertOne(payment);

          return res.send({
            transactionId,
            trackingId,
            success: true,
          });
        }

        res.send({
          success: false,
          message: "Payment not completed",
        });
      } catch (error) {
        console.error("Payment success error:", error);
        res.status(500).send({
          success: false,
          message: "Server error",
        });
      }
    });

    app.get("/payments", verifyJWT, async (req, res) => {
      try {
        const email = req.query.email;

        if (
          !email ||
          (email !== req.decoded_email && req.decoded_role !== "admin")
        ) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const cursor = paymentsCollection
          .find({ customerEmail: email })
          .sort({ paidAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Get payments error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("✅ StyleDecor Server Running");
});

// app.listen(port, () => {
//   console.log(`🚀 StyleDecor server listening on port ${port}`);
// });
module.exports = app;
