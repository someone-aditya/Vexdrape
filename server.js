
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "https://someone-aditya.github.io",
  "https://www.vexdrape.fs.kg",
  "https://vexdrape.fs.kg"
];

app.use(cors({
  origin: allowedOrigins
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    brand: "VEXDRAPE",
    status: "Backend online",
    message: "VEXDRAPE server is running."
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    website: "VEXDRAPE",
    qikink: "Not connected yet"
  });
});

app.listen(PORT, () => {
  console.log(`VEXDRAPE server running on port ${PORT}`);
});
