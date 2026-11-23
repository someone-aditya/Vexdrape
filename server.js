
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "https://someone-aditya.github.io"
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    brand: "VEXDRAPE",
    status: "Backend online",
    message: "VEXDRAPE server is running."
  });
});

app.listen(PORT, () => {
  console.log(`VEXDRAPE server running on port ${PORT}`);
});
