const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
const port = process.env.PORT;

// middleware
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  }),
);

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

    // IMPORTANT CHANGE
    req.user = payload;

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

    // all data get kora
    app.get("/ideas", async (req, res) => {
      try {
        const { search, category } = req.query;

        let query = {};

        // Search by title (case-insensitive)
        if (search) {
          query.title = {
            $regex: search,
            $options: "i",
          };
        }

        // Category filter
        if (category) {
          query.category = category;
        }

        const result = await ideaCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // Trending Ideas Section
    app.get("/tending", async (req, res) => {
      const result = await ideaCollection
        .find()
        .sort({ estimatedBudget: -1 })
        .limit(6)
        .toArray();

      res.json(result);
    });

    // detail page
    app.get("/ideas/:ideasId", verifyToken, async (req, res) => {
      const { ideasId } = req.params;

      const result = await ideaCollection.findOne({
        _id: new ObjectId(ideasId),
      });

      res.json(result);
    });

    // DELETE COMMENT
    app.delete("/comments/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        // invalid object id check
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: "Invalid comment id",
          });
        }

        // comment find
        const comment = await commentCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!comment) {
          return res.status(404).send({
            message: "Comment not found",
          });
        }

        // owner verify
        if (comment.userEmail !== req.user.email) {
          return res.status(403).send({
            message: "Forbidden access",
          });
        }

        // delete comment
        const result = await commentCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.log(error);

        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.post("/ideas", async (req, res) => {
      const ideaCereat = req.body;

      const result = await ideaCollection.insertOne(ideaCereat);

      res.json(result);
    });

    // My Ideas GET Route
    app.get("/my-ideas/:email", verifyToken, async (req, res) => {
      const { email } = req.params;

      const result = await ideaCollection.find({ userEmail: email }).toArray();

      res.send(result);
    });

    // DELETE IDEA
    app.delete("/ideas/:ideasId", verifyToken, async (req, res) => {
      try {
        const { ideasId } = req.params;

        // invalid object id check
        if (!ObjectId.isValid(ideasId)) {
          return res.status(400).send({
            message: "Invalid idea id",
          });
        }

        // idea find
        const idea = await ideaCollection.findOne({
          _id: new ObjectId(ideasId),
        });

        if (!idea) {
          return res.status(404).send({
            message: "Idea not found",
          });
        }

        // owner verify
        if (idea.userEmail !== req.user.email) {
          return res.status(403).send({
            message: "Forbidden access",
          });
        }

        // delete idea
        const result = await ideaCollection.deleteOne({
          _id: new ObjectId(ideasId),
        });

        res.send(result);
      } catch (error) {
        console.log(error);

        res.status(500).send({
          message: error.message,
        });
      }
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

    // comments add
    app.post("/comments", verifyToken, async (req, res) => {
      const commentData = req.body;

      const result = await commentCollection.insertOne(commentData);

      res.send(result);
    });

    // comments show in My Interaction
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
