import { Router } from "express";
import {
    changePassword,
    getCurrentUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
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
router.route("/current-user").get(isAuthenticated, getCurrentUser);
router.route("/update-account").patch(isAuthenticated, updateAccountDetails);

router
    .route("/avatar")
    .patch(isAuthenticated, upload.single("avatar"), updateUserAvatar);
router
    .route("/cover-image")
    .patch(isAuthenticated, upload.single("coverImage"), updateUserCoverImage);

export default router;
