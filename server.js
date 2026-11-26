
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// VEXDRAPE BACKEND CONFIGURATION
// ============================================

app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = [
  "https://someone-aditya.github.io",
  "https://www.vexdrape.fs.kg",
  "https://vexdrape.fs.kg"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Origin not allowed."));
  }
}));

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ============================================
// BASIC RATE LIMITING
// ============================================

const requestCounts = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || "unknown";
  const windowMs = 60 * 1000;
  const maxRequests = 90;

  let record = requestCounts.get(key);

  if (!record || now - record.start > windowMs) {
    record = { start: now, count: 0 };
  }

  record.count++;
  requestCounts.set(key, record);

  if (requestCounts.size > 5000) {
    for (const [ip, item] of requestCounts) {
      if (now - item.start > windowMs) {
        requestCounts.delete(ip);
      }
    }
  }

  if (record.count > maxRequests) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again shortly."
    });
  }

  next();
}

app.use("/api/gelato", rateLimit);

// ============================================
// SECURITY HELPERS
// ============================================

function authorizeTest(req, res) {
  const expected = process.env.QIKINK_TEST_KEY;
  const supplied = req.headers["x-test-key"];

  if (
    !expected ||
    typeof supplied !== "string"
  ) {
    res.status(401).json({
      success: false,
      message: "Unauthorized."
    });
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    res.status(401).json({
      success: false,
      message: "Unauthorized."
    });
    return false;
  }

  return true;
}

function validProductUid(uid) {
  return (
    typeof uid === "string" &&
    uid.length > 0 &&
    uid.length <= 200 &&
    /^[a-zA-Z0-9._:-]+$/.test(uid)
  );
}

function sendError(res, error) {
  const status =
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
      ? error.status
      : 500;

  res.status(status).json({
    success: false,
    message: error.message || "Request failed."
  });
}

// ============================================
// GELATO API CONNECTION
// ============================================

async function gelatoRequest(url, options = {}) {
  const apiKey = process.env.GELATO_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "Gelato API key is missing from Render environment variables."
    );
    error.status = 503;
    throw error;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "X-API-KEY": apiKey,
      ...(options.headers || {})
    }
  });

  const responseText = await response.text();

  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: "Unexpected response from Gelato." };
    }
  }

  if (!response.ok) {
    const error = new Error(
      data.message ||
      data.error ||
      `Gelato returned HTTP ${response.status}.`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

// ============================================
// WEBSITE STATUS
// ============================================

app.get("/", (req, res) => {
  res.json({
    brand: "VEXDRAPE",
    status: "Backend online",
    version: "1.0.0",
    providers: {
      gelato: Boolean(process.env.GELATO_API_KEY),
      qikinkSandbox: Boolean(
        process.env.QIKINK_CLIENT_ID &&
        process.env.QIKINK_CLIENT_SECRET
      )
    },
    sales: "disabled"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    website: "VEXDRAPE",
    gelato: process.env.GELATO_API_KEY
      ? "API key configured"
      : "Not configured",
    qikink: process.env.QIKINK_SANDBOX === "true"
      ? "Sandbox configured"
      : "Not configured",
    checkout: "disabled",
    payments: "disabled",
    productionOrders: "disabled"
  });
});

app.get("/api/sales/status", (req, res) => {
  res.json({
    checkout: false,
    payments: false,
    productionOrders: false,
    message: "VEXDRAPE is currently in development."
  });
});

// ============================================
// GELATO: LIST ALL CATALOGUES
// ============================================

app.get("/api/gelato/catalogs", async (req, res) => {
  try {
    const data = await gelatoRequest(
      "https://product.gelatoapis.com/v3/catalogs"
    );

    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

// ============================================
// GELATO: APPAREL CATALOGUE DETAILS
// ============================================

app.get("/api/gelato/catalog", async (req, res) => {
  try {
    const data = await gelatoRequest(
      "https://product.gelatoapis.com/v3/catalogs/apparel"
    );

    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

// ============================================
// GELATO: SEARCH APPAREL PRODUCTS
// ============================================

app.get("/api/gelato/products", async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 100, 1),
      100
    );

    const offset = Math.max(
      parseInt(req.query.offset, 10) || 0,
      0
    );

    const body = { limit, offset };

    // Optional attribute filters supplied as JSON.
    if (req.query.filters) {
      let filters;

      try {
        filters = JSON.parse(req.query.filters);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Filters must be valid JSON."
        });
      }

      if (
        !filters ||
        typeof filters !== "object" ||
        Array.isArray(filters)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid attribute filters."
        });
      }

      for (const [key, values] of Object.entries(filters)) {
        if (
          typeof key !== "string" ||
          !Array.isArray(values) ||
          !values.every(value => typeof value === "string")
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid attribute filter format."
          });
        }
      }

      body.attributeFilters = filters;
    }

    const data = await gelatoRequest(
      "https://product.gelatoapis.com/v3/catalogs/apparel/products:search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

// ============================================
// GELATO: INDIVIDUAL PRODUCT DETAILS
// ============================================

app.get("/api/gelato/products/:productUid", async (req, res) => {
  try {
    const uid = req.params.productUid;

    if (!validProductUid(uid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product UID."
      });
    }

    const data = await gelatoRequest(
      `https://product.gelatoapis.com/v3/products/${encodeURIComponent(uid)}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

// ============================================
// GELATO: PRODUCT PRICES
// ============================================

app.get("/api/gelato/prices/:productUid", async (req, res) => {
  try {
    const uid = req.params.productUid;

    if (!validProductUid(uid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product UID."
      });
    }

    const country = String(
      req.query.country || "IN"
    ).toUpperCase();

    const currency = String(
      req.query.currency || "INR"
    ).toUpperCase();

    if (
      !/^[A-Z]{2}$/.test(country) ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid country or currency code."
      });
    }

    const url = new URL(
      `https://product.gelatoapis.com/v3/products/${encodeURIComponent(uid)}/prices`
    );

    url.searchParams.set("country", country);
    url.searchParams.set("currency", currency);

    const data = await gelatoRequest(url.toString());

    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

// ============================================
// GELATO: STOCK AVAILABILITY
// ============================================

app.post("/api/gelato/stock", async (req, res) => {
  try {
    const products = req.body?.products;

    if (
      !Array.isArray(products) ||
      products.length < 1 ||
      products.length > 250 ||
      !products.every(validProductUid)
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide between 1 and 250 valid product UIDs."
      });
    }

    const data = await gelatoRequest(
      "https://product.gelatoapis.com/v3/stock/region-availability",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ products })
      }
    );

    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

// ============================================
// GELATO: PROTECTED CONNECTION TEST
// ============================================

app.post("/api/gelato/test", async (req, res) => {
  try {
    if (!authorizeTest(req, res)) return;

    const data = await gelatoRequest(
      "https://product.gelatoapis.com/v3/catalogs"
    );

    const catalogs = Array.isArray(data)
      ? data
      : data.data || [];

    res.json({
      success: true,
      message: "Gelato API authentication successful.",
      catalogsReceived: catalogs.length
    });
  } catch (error) {
    sendError(res, error);
  }
});

// ============================================
// QIKINK: PROTECTED SANDBOX TEST
// ============================================

app.post("/api/qikink/test", async (req, res) => {
  try {
    if (!authorizeTest(req, res)) return;

    if (
      !process.env.QIKINK_CLIENT_ID ||
      !process.env.QIKINK_CLIENT_SECRET
    ) {
      return res.status(503).json({
        success: false,
        message: "Qikink credentials are not configured."
      });
    }

    const form = new URLSearchParams();

    form.append(
      "ClientId",
      process.env.QIKINK_CLIENT_ID
    );

    form.append(
      "client_secret",
      process.env.QIKINK_CLIENT_SECRET
    );

    const response = await fetch(
      "https://sandbox.qikink.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: "Qikink sandbox authentication failed."
      });
    }

    res.json({
      success: true,
      message: "Qikink sandbox authentication successful."
    });
  } catch (error) {
    sendError(res, error);
  }
});

// ============================================
// UNKNOWN ROUTES
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "VEXDRAPE API route not found.",
    path: req.path
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

app.use((error, req, res, next) => {
  console.error("Backend error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    message: "An unexpected backend error occurred."
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`VEXDRAPE backend running on port ${PORT}`);
});
