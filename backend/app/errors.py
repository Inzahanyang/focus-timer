from flask import jsonify


class ApiError(Exception):
    """Raise anywhere in a request to return a consistent JSON error."""

    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def error_response(status, code, message):
    return jsonify({"error": {"code": code, "message": message}}), status


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(err):
        return error_response(err.status, err.code, err.message)

    @app.errorhandler(404)
    def handle_not_found(err):
        return error_response(
            404, "not_found", "The requested resource was not found."
        )

    @app.errorhandler(405)
    def handle_method_not_allowed(err):
        return error_response(405, "method_not_allowed", "Method not allowed.")

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        app.logger.exception("Unhandled error")
        return error_response(
            500, "internal_error", "An unexpected error occurred."
        )
