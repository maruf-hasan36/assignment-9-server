const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
const port = process.env.PORT;

// middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authheader = req?.headers.authorization;

  if (!authheader) {
    return res.status(401).send({
      message: "Unauthorized access",
    });
  }

  const token = authheader.split(" ")[1];

  if (!token) {
    return res.status(401).send({
      message: "Unauthorized access",
    });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);

    next();
  } catch (error) {
    console.log(error);

    return res.status(403).send({
      message: "Forbidden",
    });
  }
};

async function run() {
  try {
    // await client.connect();

    const db = client.db("ideaVaultAll");
    const ideaCollection = db.collection("ideas");
    const commentCollection = db.collection("comments");
    // Connect the client to the server	(optional starting in v4.7)
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    // all data get kora
    app.get("/ideas", async (req, res) => {
      try {
        const { search, category } = req.query;

        let query = {};

        //  Search by title (case-insensitive)
        if (search) {
          query.title = {
            $regex: search,
            $options: "i",
          };
        }

        //  Category filter
        if (category) {
          query.category = category;
        }

        const result = await ideaCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });
    //Trending Ideas Section
    app.get("/tending", async (req, res) => {
      const result = await ideaCollection
        .find()
        .sort({ estimatedBudget: -1 })
        .limit(6)
        .toArray();
      res.json(result);
    });
    // detisl page
    app.get("/ideas/:ideasId", verifyToken, async (req, res) => {
      const { ideasId } = req.params;
      const result = await ideaCollection.findOne({
        _id: new ObjectId(ideasId),
      });
      res.json(result);
    });

    app.post("/ideas", async (req, res) => {
      const ideaCereat = req.body;
      const result = await ideaCollection.insertOne(ideaCereat);
      res.json(result);
    });
    //My Ideas GET Route
    app.get("/my-ideas/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const result = await ideaCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    app.delete("/ideas/:ideasId", async (req, res) => {
      const { ideasId } = req.params;
      const result = await ideaCollection.deleteOne({
        _id: new ObjectId(ideasId),
      });
      res.send(result);
    });

    // Update my idea
    app.patch("/ideas/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      const result = await ideaCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updatedData,
        },
      );
      res.send(result);
    });

    //comments add
    app.post("/comments", verifyToken, async (req, res) => {
      const commentData = req.body;
      const result = await commentCollection.insertOne(commentData);
      res.send(result);
    });

    //comments  show in My Interactions
    app.get("/my-comments/:email", async (req, res) => {
      const { email } = req.params;
      const result = await commentCollection
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
