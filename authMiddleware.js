
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {

    // 1. Read the Authorization header
    const authHeader = req.headers.authorization;

    // 2. Check whether the header contains a Bearer token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is required."
        });
    }

    // 3. Extract the token
    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is required."
        });
    }

    // 4. Verify the token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

        if (err) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired authentication token."
            });
        }

        // 5. Attach the authenticated user's information
        req.user = decoded;

        // 6. Continue to the requested route
        next();
    });
}

module.exports = authenticateToken;
