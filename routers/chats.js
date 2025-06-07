import express from "express";
import {
  createChat,
  getChat,
  getChats,
  markReadNotifications,
} from "../controllers/chats.js";

const router = express.Router();

router.use("/createChat", createChat);
router.use("/getChats", getChats);
router.use("/getChat", getChat);
router.use("/markReadNotifications", markReadNotifications);

export default router;
