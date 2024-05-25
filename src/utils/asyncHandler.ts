import { NextFunction, Request, RequestHandler, Response } from "express";
import cleanupFiles from "./cleanupFiles";
import { MulterRequest } from "../controllers/user.controller";

function asyncHandler<T extends Request>(
    fn: (req: T, res: Response, next: NextFunction) => void | Promise<void>
): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req as T, res, next)).catch((error) => {
            cleanupFiles(req as MulterRequest);
            next(error);
        });
    };
}

export default asyncHandler;
