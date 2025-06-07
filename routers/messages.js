import express from "express";
import {
  changeMessage,
  deleteMessage,
  sendMessage,
  setReaction,
} from "../controllers/messages.js";

const router = express.Router();

router.use("/sendMessage", sendMessage);
router.use("/deleteMessage", deleteMessage);
router.use("/changeMessage", changeMessage);
router.use("/setReaction", setReaction);

export default router;
