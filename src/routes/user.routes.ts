import { Router } from "express";
import {
    changePassword,
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
} from "../controllers/user.controller";
import { upload } from "../middlewares/multer.middleware";
import isAuthenticated from "../middlewares/auth.middleware";

const router = Router();

router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 },
    ]),
    registerUser
);

router.route("/login").post(loginUser);

router.route("/logout").post(isAuthenticated, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(isAuthenticated, changePassword);

export default router;
