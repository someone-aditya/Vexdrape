
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

// ------------------------------------------
// HOME
// ------------------------------------------

app.get("/", (req, res) => {
  res.json({
    brand: "VEXDRAPE",
    status: "Backend online",
    integrations: ["Qikink Sandbox", "Gelato"]
  });
});

// ------------------------------------------
// HEALTH CHECK
// ------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    website: "VEXDRAPE",
    qikink: process.env.QIKINK_SANDBOX === "true"
      ? "Sandbox configured"
      : "Not configured",
    gelato: process.env.GELATO_API_KEY
      ? "API key configured"
      : "Not configured"
  });
});

// ------------------------------------------
// TEST AUTHORIZATION
// ------------------------------------------

function authorizeTest(req, res) {
  const testKey = process.env.QIKINK_TEST_KEY;

  if (!testKey || req.headers["x-test-key"] !== testKey) {
    res.status(401).json({
      success: false,
      message: "Unauthorized"
    });

    return false;
  }

  return true;
}

// ------------------------------------------
// QIKINK SANDBOX AUTHENTICATION TEST
// ------------------------------------------

app.post("/api/qikink/test", async (req, res) => {
  try {
    if (!authorizeTest(req, res)) return;

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
      return res.status(502).json({
        success: false,
        message: "Qikink authentication failed"
      });
    }

    return res.json({
      success: true,
      message: "Qikink Sandbox authentication successful!"
    });

  } catch (error) {
    console.error("Qikink test error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to connect to Qikink Sandbox"
    });
  }
});

// ------------------------------------------
// GELATO APPAREL CATALOGUE TEST
// ------------------------------------------

app.post("/api/gelato/test", async (req, res) => {
  try {
    if (!authorizeTest(req, res)) return;

    const apiKey = process.env.GELATO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Gelato API key is missing"
      });
    }

    const response = await fetch(
      "https://product.gelatoapis.com/v3/catalogs/apparel",
      {
        method: "GET",
        headers: {
          "X-API-KEY": apiKey
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gelato catalogue error:", response.status);

      return res.status(502).json({
        success: false,
        message: "Gelato Apparel catalogue request failed",
        gelatoStatus: response.status
      });
    }

    return res.json({
      success: true,
      message: "Gelato Apparel catalogue retrieved",
      catalog: data.catalogUid || "apparel",
      title: data.title || "Apparel",
      attributes: data.productAttributes || null
    });

  } catch (error) {
    console.error("Gelato test error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to connect to Gelato"
    });
  }
});

// ------------------------------------------
// SERVER
// ------------------------------------------

app.listen(PORT, () => {
  console.log(`VEXDRAPE server running on port ${PORT}`);
});
