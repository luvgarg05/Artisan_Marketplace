import jwt from "jsonwebtoken";

const TOKEN_TTL = "7d";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in the environment.");
  }
  return secret;
}

export function signToken(userId) {
  return jwt.sign({ id: userId.toString() }, getSecret(), { expiresIn: TOKEN_TTL });
}

// Rejects the request unless it carries a valid "Authorization: Bearer <token>" header.
// On success, req.userId holds the logged-in user's id.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  try {
    const payload = jwt.verify(token, getSecret());
    req.userId = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
}

// Ensures the :param in the URL refers to the logged-in user.
export function requireSelf(param) {
  return (req, res, next) => {
    if (req.params[param] !== req.userId) {
      return res.status(403).json({ message: "You can only access your own data." });
    }
    next();
  };
}
