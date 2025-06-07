import express from "express";
import { login, logout, register, verify } from "../controllers/auth.js";

const router = express.Router();

router.use("/register", register);
router.use("/verify", verify);
router.use("/login", login);
router.use("/logout", logout);

export default router;
