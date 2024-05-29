import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import ApiError from "./ApiError";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (localFilePath: string) => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);
        if (error instanceof Error)
            throw new ApiError(
                400,
                error.message ||
                    "Something went wrong while uploading on cloudinary"
            );
    }
};

export const deleteFromCloudinary = async (publicId: string) => {
    try {
        if (!publicId) return null;

        const response = await cloudinary.uploader.destroy(publicId);
        return response;
    } catch (error) {
        if (error instanceof Error)
            throw new ApiError(
                400,
                error.message ||
                    "Something went wrong while deleting from cloudinary"
            );
    }
};
