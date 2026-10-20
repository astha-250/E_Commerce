require("dotenv").config();
const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const authenticateToken = require("./authMiddleware");

const app = express();

const db = require("./db");

// Allow Express to understand JSON data
app.use(express.json());

// Allow Express to understand form data
app.use(express.urlencoded({ extended: true }));

// Serve HTML, CSS and JavaScript from public folder
app.use(express.static(path.join(__dirname, "public")));


// Home page
app.get("/", (req, res) => {

    res.sendFile(path.join(__dirname, "public", "index.html"));

});

// READ - Get all products
app.get("/products", (req, res) => {

    const sql = "SELECT * FROM products";

    db.query(sql, (err, results) => {

        if (err) {
            console.log(err);
            return res.status(500).json({
                error: "Failed to fetch products"
            });
        }

        res.json(results);
    });

});

app.get("/products/:id", (req, res) => {
    const productId = req.params.id;

    // Step 1: Validate the product ID
    if (!/^\d+$/.test(productId) || Number(productId) <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid product ID. Please provide a valid positive integer."
        });
    }

    // Step 2: Fetch the product using a parameterized query
    const query = "SELECT * FROM products WHERE Product_ID = ?";

    db.query(query, [Number(productId)], (err, results) => {
        // Step 3: Handle database errors
        if (err) {
            console.error("Error fetching product:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch product details."
            });
        }

        // Step 4: Check whether the product exists
        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // Step 5: Return the product details
        return res.status(200).json({
            success: true,
            product: results[0]
        });
    });
});

// CREATE - Add a new product
app.post("/products", (req, res) => {

    const {
        P_Name,
        P_Category,
        P_Price,
        P_Availability,
        A_ID
    } = req.body;

    const sql = `
        INSERT INTO products
        (P_Name, P_Category, P_Price, P_Availability, A_ID)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            P_Name,
            P_Category,
            P_Price,
            P_Availability,
            A_ID
        ],
        (err, result) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    error: "Failed to add product"
                });

            }

            res.json({
                message: "Product added successfully!",
                Product_ID: result.insertId
            });

        }
    );

});

// UPDATE - Update an existing product
app.put("/products/:id", (req, res) => {

    const productId = req.params.id;

    const {
        P_Name,
        P_Category,
        P_Price,
        P_Availability,
        A_ID
    } = req.body;

    const sql = `
        UPDATE products
        SET
            P_Name = ?,
            P_Category = ?,
            P_Price = ?,
            P_Availability = ?,
            A_ID = ?
        WHERE Product_ID = ?
    `;

    db.query(
        sql,
        [
            P_Name,
            P_Category,
            P_Price,
            P_Availability,
            A_ID,
            productId
        ],
        (err, result) => {

            if (err) {

                console.log("DATABASE ERROR:");
                console.log(err);

                return res.status(500).json({
                    success: false,
                    error: err.message
                });

            }

            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });

            }

            res.json({
                success: true,
                message: "Product updated successfully!"
            });

        }
    );

});

// DELETE - Delete a product
app.delete("/products/:id", (req, res) => {

    const productId = req.params.id;

    const sql = `
        DELETE FROM products
        WHERE Product_ID = ?
    `;

    db.query(sql, [productId], (err, result) => {

        if (err) {
            console.error("Error deleting product:", err);

            // Product is referenced by another table
            if (err.code === "ER_ROW_IS_REFERENCED_2") {
                return res.status(409).json({
                    success: false,
                    message: "This product cannot be deleted because it is referenced by existing delivery records."
                });
            }

            return res.status(500).json({
                success: false,
                message: "Failed to delete product."
            });
        }

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            message: "Product deleted successfully!"
        });

    });

});


// ==========================================
// CREATE - Register a new customer securely
// ==========================================

const bcrypt = require("bcryptjs");


app.post("/customers", async (req, res) => {
    try {
        const {
            User_Name,
            Password,
            Mobile_Number,
            Email_Address,
            Country = "",
            District = "",
            Address = ""
        } = req.body;

        // 1. Validate required fields
        if (
            typeof User_Name !== "string" ||
            typeof Password !== "string" ||
            typeof Mobile_Number !== "string" ||
            typeof Email_Address !== "string" ||
            !User_Name.trim() ||
            !Password ||
            !Mobile_Number.trim() ||
            !Email_Address.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid username, password, mobile number and email."
            });
        }

        const username = User_Name.trim();
        const email = Email_Address.trim().toLowerCase();
        const mobile = Mobile_Number.trim();

        // 2. Validate username length
        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Username must be between 3 and 50 characters."
            });
        }

        // 3. Validate password length
        if (Password.length < 8 || Password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must be between 8 and 72 characters."
            });
        }

        // 4. Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // 5. Validate mobile number
        const mobileRegex = /^\+?[0-9]{10,15}$/;

        if (!mobileRegex.test(mobile)) {
            return res.status(400).json({
                success: false,
                message: "Mobile number must contain 10–15 digits, optionally preceded by +."
            });
        }

        // 6. Validate optional fields
        if (
            typeof Country !== "string" ||
            typeof District !== "string" ||
            typeof Address !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Country, district and address must be text values."
            });
        }

        // 7. Hash the password
        const hashedPassword = await bcrypt.hash(Password, 12);

        // 8. Insert customer into the database
        const sql = `
            INSERT INTO customer
            (
                User_Name,
                Password,
                Mobile_Number,
                Email_Address,
                Country,
                District,
                Address
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                username,
                hashedPassword,
                mobile,
                email,
                Country.trim(),
                District.trim(),
                Address.trim()
            ],
            (err, result) => {
                if (err) {
                    console.error("Customer registration error:", err);

                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            success: false,
                            message: "This username or email is already registered."
                        });
                    }

                    return res.status(500).json({
                        success: false,
                        message: "Failed to register customer."
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Customer registered successfully!",
                    C_ID: result.insertId
                });
            }
        );

    } catch (err) {
        console.error("Customer registration error:", err);

        return res.status(500).json({
            success: false,
            message: "An error occurred during registration."
        });
    }
});

// ==========================================
// READ - Get All Customers
// ==========================================


app.get("/customers", (req, res) => {

    const sql = `
        SELECT
            C_ID,
            User_Name,
            Mobile_Number,
            Email_Address,
            Country,
            District,
            Address
        FROM customer
    `;

    db.query(sql, (err, results) => {

        // Handle database errors safely
        if (err) {
            console.error("Error fetching customers:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch customers."
            });
        }

        // Return customer details without password information
        return res.status(200).json({
            success: true,
            customers: results
        });

    });

});

// ==========================================
// CUSTOMER LOGIN - Verify password securely
// ==========================================

app.post("/login", (req, res) => {
    const { User_Name, Password } = req.body;

    // 1. Validate the request
    if (
        typeof User_Name !== "string" ||
        typeof Password !== "string" ||
        !User_Name.trim() ||
        !Password
    ) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required."
        });
    }

    // 2. Find the customer by username
    const sql = `
        SELECT
            C_ID,
            User_Name,
            Password
        FROM customer
        WHERE User_Name = ?
    `;

    db.query(sql, [User_Name.trim()], async (err, results) => {
        try {
            // 3. Handle database errors
            if (err) {
                console.error("Login database error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Login failed. Please try again."
                });
            }

            // 4. Check whether the customer exists
            if (results.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid username or password."
                });
            }

            const customer = results[0];
            const storedPassword = customer.Password;

            // 5. Detect a bcrypt password hash
            const isBcryptHash =
                typeof storedPassword === "string" &&
                /^\$2[aby]\$\d{2}\$/.test(storedPassword);

            let passwordMatches = false;

            if (isBcryptHash) {
                // Verify the submitted password against the hash
                passwordMatches = await bcrypt.compare(
                    Password,
                    storedPassword
                );
            } else {
                // Temporary compatibility for old plaintext passwords
                passwordMatches = Password === storedPassword;

                if (passwordMatches) {
                    // Convert the old password to a bcrypt hash
                    const upgradedHash = await bcrypt.hash(Password, 12);

                    db.query(
                        `
                            UPDATE customer
                            SET Password = ?
                            WHERE C_ID = ?
                        `,
                        [upgradedHash, customer.C_ID],
                        (updateErr) => {
                            if (updateErr) {
                                console.error(
                                    "Password upgrade error:",
                                    updateErr
                                );
                            }
                        }
                    );
                }
            }

            // 6. Reject incorrect passwords
            if (!passwordMatches) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid username or password."
                });
            }

            // Generate a JWT for the authenticated customer
            const token = jwt.sign(
                {
                    sub: String(customer.C_ID),
                    username: customer.User_Name,
                    role: "customer"
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1h"
                }
            );

            // Return the token and customer details
            return res.status(200).json({
                success: true,
                message: "Login successful!",
                token: token,
                C_ID: customer.C_ID,
                User_Name: customer.User_Name
            });

        } catch (loginError) {
            console.error("Login processing error:", loginError);

            return res.status(500).json({
                success: false,
                message: "An error occurred during login."
            });
        }
    });
});
// ==========================================
// ADMIN LOGIN - Separate authentication
// ==========================================

app.post("/admin/login", (req, res) => {
    const { User_Name, Password } = req.body;

    // Validate input
    if (
        typeof User_Name !== "string" ||
        typeof Password !== "string" ||
        !User_Name.trim() ||
        !Password
    ) {
        return res.status(400).json({
            success: false,
            message: "Admin username and password are required."
        });
    }

    // Find the administrator
    const sql = `
        SELECT A_ID, User_Name, Password
        FROM admin
        WHERE User_Name = ?
    `;

    db.query(sql, [User_Name.trim()], async (err, results) => {
        try {
            if (err) {
                console.error("Admin login database error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Admin login failed. Please try again."
                });
            }

            if (results.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid admin username or password."
                });
            }

            const admin = results[0];

            // Admin passwords must be stored as bcrypt hashes
            const isBcryptHash =
                typeof admin.Password === "string" &&
                /^\$2[aby]\$\d{2}\$/.test(admin.Password);

            if (!isBcryptHash) {
                return res.status(401).json({
                    success: false,
                    message: "Admin password is not securely configured."
                });
            }

            const passwordMatches = await bcrypt.compare(
                Password,
                admin.Password
            );

            if (!passwordMatches) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid admin username or password."
                });
            }

            // Generate an admin-specific JWT
            const token = jwt.sign(
                {
                    sub: String(admin.A_ID),
                    username: admin.User_Name,
                    role: "admin"
                },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            return res.status(200).json({
                success: true,
                message: "Admin login successful!",
                token,
                A_ID: admin.A_ID,
                User_Name: admin.User_Name
            });

        } catch (loginError) {
            console.error("Admin login processing error:", loginError);

            return res.status(500).json({
                success: false,
                message: "An error occurred during admin login."
            });
        }
    });
});

// ==========================================
// ADD PRODUCT TO SHOPPING CART
// ==========================================

app.post("/cart", (req, res) => {

    const {
        C_ID,
        Product_ID,
        Quantity
    } = req.body;

    // First get product details
    const productSql = `
        SELECT
            Product_ID,
            P_Name,
            P_Price,
            P_Availability
        FROM products
        WHERE Product_ID = ?
    `;

    db.query(
        productSql,
        [Product_ID],
        (err, products) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to find product"
                });

            }

            if (products.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });

            }

            const product = products[0];

            // Check availability
            if (
                product.P_Availability !== "Available"
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Product is currently unavailable"
                });

            }

            const totalPrice =
                Number(product.P_Price) *
                Number(Quantity);


            // Insert into shopping cart
            const cartSql = `
                INSERT INTO shopping_cart
                (
                    C_ID,
                    Product_ID,
                    Product_Name,
                    Total_Price,
                    Billing_Products
                )
                VALUES (?, ?, ?, ?, ?)
            `;

            db.query(
                cartSql,
                [
                    C_ID,
                    Product_ID,
                    product.P_Name,
                    totalPrice,
                    Quantity
                ],
                (err, result) => {

                    if (err) {

                        console.log(
                            "CART DATABASE ERROR:"
                        );

                        console.log(err);

                        return res.status(500).json({
                            success: false,
                            message: "Failed to add product to cart",
                            error: err.message
                        });

                    }

                    res.json({

                        success: true,

                        message:
                            "Product added to cart successfully!",

                        Cart_ID:
                            result.insertId

                    });

                }
            );

        }
    );

});

// ==========================================
// VIEW CUSTOMER CART
// ==========================================

app.get("/cart/:customerId", (req, res) => {

    const customerId = req.params.customerId;

    const sql = `
        SELECT
            Cart_ID,
            Product_ID,
            Product_Name,
            Total_Price,
            Billing_Products
        FROM shopping_cart
        WHERE C_ID = ?
    `;

    db.query(
        sql,
        [customerId],
        (err, results) => {

            if (err) {

                console.log("CART ERROR:");
                console.log(err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to load cart",
                    error: err.message
                });

            }

            res.json(results);

        }
    );

});
app.get("/protected-test", authenticateToken, (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Authentication successful!",
        user: {
            C_ID: req.user.sub,
            User_Name: req.user.username,
            Role: req.user.role
        }
    });
});

app.delete("/cart/:cartId", authenticateToken, (req, res) => {
    const cartId = Number(req.params.cartId);
    const customerId = Number(req.user.sub);

    // Validate the cart ID
    if (!Number.isSafeInteger(cartId) || cartId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid cart item ID."
        });
    }

    // Ensure the token belongs to a customer
    if (
        req.user.role !== "customer" ||
        !Number.isSafeInteger(customerId) ||
        customerId <= 0
    ) {
        return res.status(403).json({
            success: false,
            message: "Only authenticated customers can remove cart items."
        });
    }

    // Delete only the specified cart record belonging to this customer
    const sql = `
        DELETE FROM shopping_cart
        WHERE Cart_ID = ?
          AND C_ID = ?
    `;

    db.query(sql, [cartId, customerId], (err, result) => {
        if (err) {
            console.error("Cart item deletion error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to remove the item from your cart."
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item removed from your cart successfully."
        });
    });
});

// Start server
const PORT = process.env.PORT || 5000;


app.listen(PORT, () => {

    console.log("Server running at http://localhost:5000");

});