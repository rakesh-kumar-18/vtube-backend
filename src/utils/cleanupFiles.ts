import fs from "fs";
import { MulterRequest } from "../controllers/user.controller";

const cleanupFiles = (req: MulterRequest): void => {
    if (req.files) {
        Object.keys(req.files).forEach((key) => {
            req.files[key].forEach((file) => {
                fs.unlink(file.path, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error(
                            `Failed to delete file: ${file.path}`,
                            unlinkErr
                        );
                    }
                });
            });
        });
    }
};

export default cleanupFiles;
