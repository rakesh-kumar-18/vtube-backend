class ApiError extends Error {
    statusCode: number;
    data: null;
    success: boolean;
    errors: string[];

    constructor(
        statusCode: number,
        message: string = "something went wrong",
        errors: string[] = [],
        stack: string = ""
    ) {
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.success = false;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export default ApiError;
