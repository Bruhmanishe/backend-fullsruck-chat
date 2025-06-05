import express from "express";
import { getUser, getUsers } from "../controllers/users.js";

const router = express.Router();

router.use("/getUser", getUser);
router.use("/getUsers", getUsers);

export default router;
