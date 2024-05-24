import { NextFunction, Request, RequestHandler, Response } from "express";

function asyncHandler<T extends Request>(
    fn: (req: T, res: Response, next: NextFunction) => void | Promise<void>
): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req as T, res, next)).catch(next);
    };
}

export default asyncHandler;
