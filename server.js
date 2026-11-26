
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "https://someone-aditya.github.io",
  "https://www.vexdrape.fs.kg",
  "https://vexdrape.fs.kg"
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    brand: "VEXDRAPE",
    status: "Backend online"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    website: "VEXDRAPE",
    qikink: "Sandbox configured"
  });
});

app.post("/api/qikink/test", async (req, res) => {
  try {
    const testKey = process.env.QIKINK_TEST_KEY;

    if (!testKey || req.headers["x-test-key"] !== testKey) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (process.env.QIKINK_SANDBOX !== "true") {
      return res.status(403).json({
        success: false,
        message: "Sandbox mode is not enabled"
      });
    }

    const clientId = process.env.QIKINK_CLIENT_ID;
    const clientSecret = process.env.QIKINK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: "Qikink credentials are missing"
      });
    }

    const params = new URLSearchParams();
    params.append("ClientId", clientId);
    params.append("client_secret", clientSecret);

    const response = await fetch(
      "https://sandbox.qikink.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
      }
    );

    const data = await response.json();

    if (!response.ok || !data.Accesstoken) {
      console.error("Qikink authentication failed:", response.status);

      return res.status(502).json({
        success: false,
        message: "Qikink authentication failed"
      });
    }

    return res.json({
      success: true,
      message: "Qikink Sandbox authentication successful!",
      tokenReceived: true
    });

  } catch (error) {
    console.error("Qikink test error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to connect to Qikink Sandbox"
    });
  }
});

app.post("/api/gelato/test", async (req, res) => {
  try {
    const testKey = process.env.QIKINK_TEST_KEY;

    if (!testKey || req.headers["x-test-key"] !== testKey) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const apiKey = process.env.GELATO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Gelato API key is missing"
      });
    }

    const response = await fetch(
      "https://product.gelatoapis.com/v3/catalogs",
      {
        method: "GET",
        headers: {
          "X-API-KEY": apiKey
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: "Gelato API request failed",
        gelatoStatus: response.status
      });
    }

    const catalogs = await response.json();

    return res.json({
      success: true,
      message: "Gelato API authentication successful!",
      catalogsReceived: Array.isArray(catalogs)
        ? catalogs.length
        : 0
    });

  } catch (error) {
    console.error("Gelato test error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to connect to Gelato"
    });
  }
});

app.listen(PORT, () => {
  console.log(`VEXDRAPE server running on port ${PORT}`);
});
