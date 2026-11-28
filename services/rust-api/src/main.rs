use axum::{
    extract::Path,
    http::{header, HeaderValue, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tower_http::{cors::CorsLayer, set_header::SetResponseHeaderLayer};
use tracing::{info, Level};
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

/// Health check response
#[derive(Serialize, ToSchema)]
struct HealthResponse {
    status: String,
    version: String,
}

/// Example request body
#[derive(Deserialize, ToSchema)]
struct CreateItemRequest {
    name: String,
    description: Option<String>,
}

/// Example response
#[derive(Serialize, ToSchema)]
struct ItemResponse {
    id: String,
    name: String,
    description: Option<String>,
    created_at: String,
}

/// Error response
#[derive(Serialize, ToSchema)]
struct ErrorResponse {
    error: String,
    message: String,
}

/// Timeline event (demonstrates Rust REST)
#[derive(Serialize, ToSchema)]
struct TimelineEvent {
    id: String,
    year: u32,
    title: String,
    short_description: String,
    theory_tags: Vec<String>,
}

/// Paginated timeline response
#[derive(Serialize, ToSchema)]
struct TimelineResponse {
    events: Vec<TimelineEvent>,
    total: usize,
    page: u32,
    per_page: u32,
}

/// OpenAPI documentation
#[derive(OpenApi)]
#[openapi(
    paths(
        health_check,
        get_timeline,
        get_item,
        create_item
    ),
    components(schemas(
        HealthResponse,
        TimelineEvent,
        TimelineResponse,
        CreateItemRequest,
        ItemResponse,
        ErrorResponse
    )),
    tags(
        (name = "health", description = "Health check endpoints"),
        (name = "timeline", description = "SW Timeline events"),
        (name = "items", description = "Item management endpoints")
    ),
    info(
        title = "Rust API",
        description = "High-performance REST API built with Rust and Axum",
        version = "0.1.0",
        contact(
            name = "João Figueredo",
            email = "63759223+jpfigueredo@users.noreply.github.com"
        )
    )
)]
struct ApiDoc;

/// Health check endpoint
#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = HealthResponse)
    )
)]
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Get paginated SW Timeline events
#[utoipa::path(
    get,
    path = "/api/timeline",
    tag = "timeline",
    params(
        ("page" = Option<u32>, Query, description = "Page number (1-based, default 1)"),
        ("per_page" = Option<u32>, Query, description = "Items per page (default 10, max 50)")
    ),
    responses(
        (status = 200, description = "List of timeline events", body = TimelineResponse)
    )
)]
async fn get_timeline() -> Json<TimelineResponse> {
    let events = vec![
        TimelineEvent {
            id: "turing-1936".into(),
            year: 1936,
            title: "Máquina de Turing".into(),
            short_description:
                "Alan Turing define formalmente o conceito de computação algorítmica.".into(),
            theory_tags: vec!["theory".into(), "labor".into()],
        },
        TimelineEvent {
            id: "eniac-1945".into(),
            year: 1945,
            title: "ENIAC".into(),
            short_description:
                "Primeiro computador eletrônico de propósito geral entra em operação.".into(),
            theory_tags: vec!["industry".into(), "labor".into()],
        },
        TimelineEvent {
            id: "unix-1969".into(),
            year: 1969,
            title: "Unix".into(),
            short_description: "Ken Thompson e Dennis Ritchie criam o Unix nos Bell Labs.".into(),
            theory_tags: vec!["industry".into(), "oss".into()],
        },
        TimelineEvent {
            id: "gnu-1983".into(),
            year: 1983,
            title: "GNU Project".into(),
            short_description: "Richard Stallman lança o GNU Project e a Free Software Foundation."
                .into(),
            theory_tags: vec!["oss".into(), "theory".into()],
        },
        TimelineEvent {
            id: "linux-1991".into(),
            year: 1991,
            title: "Linux".into(),
            short_description: "Linus Torvalds inicia o kernel Linux como projeto pessoal.".into(),
            theory_tags: vec!["oss".into(), "industry".into()],
        },
        TimelineEvent {
            id: "agile-2001".into(),
            year: 2001,
            title: "Manifesto Ágil".into(),
            short_description:
                "Dezessete desenvolvedores publicam o Manifesto para Desenvolvimento Ágil.".into(),
            theory_tags: vec!["theory".into(), "labor".into()],
        },
        TimelineEvent {
            id: "kubernetes-2014".into(),
            year: 2014,
            title: "Kubernetes".into(),
            short_description:
                "Google open-sourcea o Kubernetes, transformando infraestrutura de software.".into(),
            theory_tags: vec!["industry".into(), "oss".into()],
        },
        TimelineEvent {
            id: "chatgpt-2022".into(),
            year: 2022,
            title: "ChatGPT".into(),
            short_description: "OpenAI lança o ChatGPT, popularizando os Large Language Models."
                .into(),
            theory_tags: vec!["theory".into(), "labor".into()],
        },
    ];
    let total = events.len();
    Json(TimelineResponse {
        events,
        total,
        page: 1,
        per_page: 10,
    })
}

/// Current UTC time in RFC 3339, e.g. `2026-11-27T12:34:56.123456789Z`:
/// `Z` for UTC and the fraction of a second without trailing zeros.
fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .expect("a UTC time with a four-digit year is valid RFC 3339")
}

/// Get item by ID
#[utoipa::path(
    get,
    path = "/api/v1/items/{id}",
    tag = "items",
    params(
        ("id" = String, Path, description = "Item ID")
    ),
    responses(
        (status = 200, description = "Item found", body = ItemResponse),
        (status = 404, description = "Item not found", body = ErrorResponse)
    )
)]
async fn get_item(Path(id): Path<String>) -> Result<Json<ItemResponse>, StatusCode> {
    // Example: return mock data
    // In a real app, you'd query a database here
    if id == "example" {
        Ok(Json(ItemResponse {
            id: "example".to_string(),
            name: "Example Item".to_string(),
            description: Some("This is an example item".to_string()),
            created_at: now_rfc3339(),
        }))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Create a new item
#[utoipa::path(
    post,
    path = "/api/v1/items",
    tag = "items",
    request_body = CreateItemRequest,
    responses(
        (status = 201, description = "Item created", body = ItemResponse),
        (status = 400, description = "Invalid request", body = ErrorResponse)
    )
)]
async fn create_item(
    Json(payload): Json<CreateItemRequest>,
) -> Result<Json<ItemResponse>, StatusCode> {
    // Example: create item
    // In a real app, you'd save to a database here
    let item = ItemResponse {
        id: uuid::Uuid::new_v4().to_string(),
        name: payload.name,
        description: payload.description,
        created_at: now_rfc3339(),
    };

    Ok(Json(item))
}

/// CSP for everything except the Swagger UI: JSON and errors load nothing
/// and must not be framed.
const API_CSP: &str = "default-src 'none'; frame-ancestors 'none'";

/// CSP for the Swagger UI 5.32.6 routes. Each directive is what the page
/// needs, checked in Chrome with no violation:
/// - script-src 'self': index.html loads three same-origin files and has no
///   inline script (the configuration is swagger-initializer.js);
/// - style-src 'self' + one hash: two same-origin stylesheets, plus the one
///   inline <style> the page creates, inside the top bar's SVG logo
///   (swagger-ui-standalone-preset.js; the test
///   `swagger_ui_logo_style_matches_the_csp_hash` pins its text). A hash, not
///   'unsafe-inline': nothing else inline may style the page;
/// - img-src 'self' data:: favicons, and swagger-ui.css draws its icons with
///   data: URLs (SVG, PNG, JPEG);
/// - connect-src 'self': the UI fetches /api-docs/openapi.json and "Try it
///   out" calls this API;
/// - form-action 'self', base-uri 'none': no form posts elsewhere, no <base>.
const SWAGGER_UI_CSP: &str = "default-src 'none'; script-src 'self'; \
     style-src 'self' 'sha256-RL3ie0nH+Lzz2YNqQN83mnU0J1ot4QL7b99vMdIX99w='; \
     img-src 'self' data:; connect-src 'self'; base-uri 'none'; \
     form-action 'self'; frame-ancestors 'none'";

/// Application routes. Kept apart from `main` so tests can drive the same
/// `Router` in-process, without binding a socket.
fn app() -> Router {
    // The Swagger UI routes (page, assets, spec) set their own CSP; the
    // outer layer adds API_CSP only where none is set. `route_layer`, not
    // `layer`: `layer` would also wrap this router's fallback, and after the
    // merge every unknown path (404) would get the Swagger UI CSP.
    let docs = Router::from(
        SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()),
    )
    .route_layer(SetResponseHeaderLayer::overriding(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(SWAGGER_UI_CSP),
    ));

    Router::new()
        .merge(docs)
        .route("/health", get(health_check))
        .route("/api/timeline", get(get_timeline))
        .route("/api/v1/items/{id}", get(get_item))
        .route("/api/v1/items", post(create_item))
        .layer(CorsLayer::permissive())
        // Outside the CORS layer, so its preflight answers get them too.
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(API_CSP),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::REFERRER_POLICY,
            HeaderValue::from_static("no-referrer"),
        ))
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .with_target(false)
        .init();

    let app = app();

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    info!("🚀 Server starting on http://{}", addr);
    info!("📚 Swagger UI available at http://{}/swagger-ui", addr);
    info!(
        "📖 OpenAPI spec available at http://{}/api-docs/openapi.json",
        addr
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Route tests. Each test sends one request through `app()` with
/// `tower::ServiceExt::oneshot`: in-process, no socket, no network.
///
/// CI (rust-checks) fails if fewer than `RUST_MIN_TESTS` tests pass or if any
/// test is ignored. When you add or remove a test, update `RUST_MIN_TESTS` in
/// .github/workflows/ci.yml in the same PR.
#[cfg(test)]
mod tests {
    use super::app;
    use axum::{
        body::{to_bytes, Body},
        http::{header, HeaderMap, Method, Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    // Large enough for swagger-ui-bundle.js (about 1.5 MiB in 5.32.6).
    const BODY_LIMIT: usize = 4 * 1024 * 1024;

    async fn send(request: Request<Body>) -> (StatusCode, Vec<u8>) {
        let response = app().oneshot(request).await.expect("router is infallible");
        let status = response.status();
        let body = to_bytes(response.into_body(), BODY_LIMIT)
            .await
            .expect("response body");
        (status, body.to_vec())
    }

    async fn get(uri: &str) -> (StatusCode, Vec<u8>) {
        send(Request::builder().uri(uri).body(Body::empty()).unwrap()).await
    }

    async fn post_json(uri: &str, json: &'static str) -> (StatusCode, Vec<u8>) {
        let request = Request::builder()
            .method(Method::POST)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json))
            .unwrap();
        send(request).await
    }

    fn json(body: &[u8]) -> Value {
        serde_json::from_slice(body).expect("JSON body")
    }

    #[tokio::test]
    async fn health_returns_ok_and_crate_version() {
        let (status, body) = get("/health").await;
        assert_eq!(status, StatusCode::OK);
        let body = json(&body);
        assert_eq!(body["status"], "ok");
        assert_eq!(body["version"], env!("CARGO_PKG_VERSION"));
    }

    #[tokio::test]
    async fn timeline_returns_events_in_order_with_matching_total() {
        let (status, body) = get("/api/timeline").await;
        assert_eq!(status, StatusCode::OK);
        let body = json(&body);
        let events = body["events"].as_array().expect("events array");
        assert!(!events.is_empty());
        assert_eq!(body["total"].as_u64(), Some(events.len() as u64));
        assert_eq!(body["page"], 1);
        assert_eq!(body["per_page"], 10);
        for event in events {
            assert!(!event["id"].as_str().expect("id").is_empty());
            assert!(!event["title"].as_str().expect("title").is_empty());
            assert!(event["theory_tags"].is_array());
        }
        let years: Vec<u64> = events
            .iter()
            .map(|event| event["year"].as_u64().expect("year"))
            .collect();
        assert!(
            years.windows(2).all(|pair| pair[0] <= pair[1]),
            "events out of chronological order: {years:?}"
        );
    }

    #[tokio::test]
    async fn get_example_item_returns_it() {
        let (status, body) = get("/api/v1/items/example").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(json(&body)["id"], "example");
    }

    #[tokio::test]
    async fn get_unknown_item_returns_404() {
        let (status, _) = get("/api/v1/items/does-not-exist").await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn create_item_echoes_payload_with_new_uuid() {
        let (status, body) = post_json(
            "/api/v1/items",
            r#"{"name":"Widget","description":"A test item"}"#,
        )
        .await;
        // The handler returns 200 today (the OpenAPI doc says 201).
        assert_eq!(status, StatusCode::OK);
        let body = json(&body);
        assert_eq!(body["name"], "Widget");
        assert_eq!(body["description"], "A test item");
        let id = body["id"].as_str().expect("id");
        assert!(uuid::Uuid::parse_str(id).is_ok(), "not a UUID: {id}");
    }

    #[tokio::test]
    async fn created_at_is_rfc3339_utc_with_z_and_the_request_time() {
        use time::{format_description::well_known::Rfc3339, OffsetDateTime, UtcOffset};

        for (method, uri, json_body) in [
            (Method::GET, "/api/v1/items/example", ""),
            (Method::POST, "/api/v1/items", r#"{"name":"Widget"}"#),
        ] {
            let request = Request::builder()
                .method(method.clone())
                .uri(uri)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json_body))
                .unwrap();
            let before = OffsetDateTime::now_utc();
            let (status, body) = send(request).await;
            let after = OffsetDateTime::now_utc();
            assert_eq!(status, StatusCode::OK, "{method} {uri}");

            let body = json(&body);
            let created_at = body["created_at"].as_str().expect("created_at string");
            let parsed = OffsetDateTime::parse(created_at, &Rfc3339)
                .unwrap_or_else(|e| panic!("{method} {uri}: not RFC 3339: {created_at}: {e}"));
            assert_eq!(parsed.offset(), UtcOffset::UTC, "{method} {uri}");
            // Canonical form: `Z` for UTC (not `+00:00`), fraction without
            // trailing zeros.
            assert_eq!(
                parsed.format(&Rfc3339).unwrap(),
                created_at,
                "{method} {uri}"
            );
            assert!(
                before <= parsed && parsed <= after,
                "{method} {uri}: {created_at} is not between {before} and {after}"
            );
        }
    }

    #[tokio::test]
    async fn create_item_without_name_is_rejected() {
        let (status, _) = post_json("/api/v1/items", r#"{"description":"no name"}"#).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn openapi_spec_lists_every_route() {
        let (status, body) = get("/api-docs/openapi.json").await;
        assert_eq!(status, StatusCode::OK);
        let paths = json(&body)["paths"].clone();
        for path in [
            "/health",
            "/api/timeline",
            "/api/v1/items",
            "/api/v1/items/{id}",
        ] {
            assert!(paths.get(path).is_some(), "missing path in spec: {path}");
        }
    }

    #[tokio::test]
    async fn swagger_ui_assets_are_embedded_and_point_to_the_spec() {
        let (status, body) = get("/swagger-ui/swagger-initializer.js").await;
        assert_eq!(status, StatusCode::OK);
        let script = String::from_utf8(body).expect("UTF-8 script");
        assert!(script.contains("/api-docs/openapi.json"));
    }

    #[tokio::test]
    async fn unknown_route_returns_404() {
        let (status, _) = get("/does-not-exist").await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn openapi_spec_is_3_1_and_declares_the_id_path_param() {
        let (status, body) = get("/api-docs/openapi.json").await;
        assert_eq!(status, StatusCode::OK);
        let spec = json(&body);
        assert_eq!(spec["openapi"], "3.1.0");
        let params = spec["paths"]["/api/v1/items/{id}"]["get"]["parameters"]
            .as_array()
            .expect("parameters of GET /api/v1/items/{id}");
        assert!(
            params
                .iter()
                .any(|p| p["name"] == "id" && p["in"] == "path" && p["required"] == true),
            "id path parameter missing: {params:?}"
        );
    }

    #[tokio::test]
    async fn item_id_is_percent_decoded_before_lookup() {
        let (status, body) = get("/api/v1/items/exampl%65").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(json(&body)["id"], "example");
    }

    #[tokio::test]
    async fn item_id_with_invalid_utf8_is_rejected_with_400() {
        let (status, body) = get("/api/v1/items/%FF").await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        let text = String::from_utf8(body).expect("UTF-8 body");
        assert!(text.contains("Invalid UTF-8"), "unexpected body: {text}");
    }

    #[tokio::test]
    async fn item_routes_do_not_match_empty_trailing_or_extra_segments() {
        for uri in [
            "/api/v1/items/",
            "/api/v1/items/example/",
            "/api/v1/items/example/extra",
            "/health/",
        ] {
            let (status, _) = get(uri).await;
            assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
        }
    }

    #[tokio::test]
    async fn wrong_method_returns_405_with_allow_header() {
        for (method, uri, allow) in [
            (Method::POST, "/health", "GET,HEAD"),
            (Method::DELETE, "/api/v1/items/example", "GET,HEAD"),
            (Method::GET, "/api/v1/items", "POST"),
        ] {
            let request = Request::builder()
                .method(method.clone())
                .uri(uri)
                .body(Body::empty())
                .unwrap();
            let response = app().oneshot(request).await.expect("router is infallible");
            assert_eq!(
                response.status(),
                StatusCode::METHOD_NOT_ALLOWED,
                "{method} {uri}"
            );
            assert_eq!(response.headers()[header::ALLOW], allow, "{method} {uri}");
        }
    }

    #[tokio::test]
    async fn create_item_with_malformed_json_returns_400() {
        let (status, _) = post_json("/api/v1/items", r#"{"name":"#).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn create_item_without_json_content_type_returns_415() {
        let request = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/items")
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::from(r#"{"name":"Widget"}"#))
            .unwrap();
        let (status, _) = send(request).await;
        assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }

    #[tokio::test]
    async fn timeline_today_ignores_page_and_per_page_query() {
        // Characterization test: it pins today's behavior, not the intended
        // one. The handler accepts and ignores page/per_page (invalid values
        // included), although the OpenAPI doc lists them as parameters.
        for uri in [
            "/api/timeline?page=2&per_page=5",
            "/api/timeline?page=abc&per_page=-1",
        ] {
            let (status, body) = get(uri).await;
            assert_eq!(status, StatusCode::OK, "{uri}");
            assert_eq!(json(&body)["page"], 1, "{uri}");
        }
    }

    #[tokio::test]
    async fn swagger_ui_without_trailing_slash_redirects_to_it() {
        let request = Request::builder()
            .uri("/swagger-ui")
            .body(Body::empty())
            .unwrap();
        let response = app().oneshot(request).await.expect("router is infallible");
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
        assert_eq!(response.headers()[header::LOCATION], "/swagger-ui/");
    }

    const PAGES_ORIGIN: &str = "https://jpfigueredo.github.io";

    async fn headers_of(request: Request<Body>) -> (StatusCode, HeaderMap) {
        let response = app().oneshot(request).await.expect("router is infallible");
        (response.status(), response.headers().clone())
    }

    fn request(method: Method, uri: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .body(Body::empty())
            .unwrap()
    }

    fn preflight(uri: &str, origin: &str) -> Request<Body> {
        Request::builder()
            .method(Method::OPTIONS)
            .uri(uri)
            .header(header::ORIGIN, origin)
            .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
            .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "content-type")
            .body(Body::empty())
            .unwrap()
    }

    #[tokio::test]
    async fn every_response_has_the_security_headers() {
        // JSON, errors from the router (404, 405, 400), the preflight that
        // the CORS layer answers by itself, and the Swagger UI files.
        for req in [
            request(Method::GET, "/health"),
            request(Method::GET, "/api/v1/items/does-not-exist"),
            request(Method::GET, "/does-not-exist"),
            request(Method::POST, "/health"),
            request(Method::GET, "/api/v1/items/%FF"),
            preflight("/api/v1/items", PAGES_ORIGIN),
            request(Method::GET, "/api-docs/openapi.json"),
            request(Method::GET, "/swagger-ui"),
            request(Method::GET, "/swagger-ui/"),
            request(Method::GET, "/swagger-ui/swagger-ui-bundle.js"),
        ] {
            let label = format!("{} {}", req.method(), req.uri());
            let (_, headers) = headers_of(req).await;
            assert_eq!(
                headers
                    .get(header::X_CONTENT_TYPE_OPTIONS)
                    .and_then(|v| v.to_str().ok()),
                Some("nosniff"),
                "{label}"
            );
            assert_eq!(
                headers
                    .get(header::X_FRAME_OPTIONS)
                    .and_then(|v| v.to_str().ok()),
                Some("DENY"),
                "{label}"
            );
            assert_eq!(
                headers
                    .get(header::REFERRER_POLICY)
                    .and_then(|v| v.to_str().ok()),
                Some("no-referrer"),
                "{label}"
            );
            let csp: Vec<_> = headers
                .get_all(header::CONTENT_SECURITY_POLICY)
                .iter()
                .map(|v| v.to_str().expect("ASCII CSP"))
                .collect();
            assert_eq!(csp.len(), 1, "{label}: CSP headers {csp:?}");
            assert!(
                csp[0].contains("frame-ancestors 'none'"),
                "{label}: {csp:?}"
            );
        }
    }

    #[tokio::test]
    async fn api_responses_get_the_deny_everything_csp() {
        for req in [
            request(Method::GET, "/health"),
            request(Method::GET, "/api/timeline"),
            request(Method::GET, "/does-not-exist"),
            request(Method::POST, "/health"),
        ] {
            let label = format!("{} {}", req.method(), req.uri());
            let (_, headers) = headers_of(req).await;
            assert_eq!(
                headers
                    .get(header::CONTENT_SECURITY_POLICY)
                    .and_then(|v| v.to_str().ok()),
                Some("default-src 'none'; frame-ancestors 'none'"),
                "{label}"
            );
        }
    }

    #[tokio::test]
    async fn swagger_ui_page_gets_a_same_origin_csp_and_has_no_inline_script() {
        let response = app()
            .oneshot(request(Method::GET, "/swagger-ui/"))
            .await
            .expect("router is infallible");
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_SECURITY_POLICY)
                .and_then(|v| v.to_str().ok()),
            Some(
                "default-src 'none'; script-src 'self'; \
                 style-src 'self' 'sha256-RL3ie0nH+Lzz2YNqQN83mnU0J1ot4QL7b99vMdIX99w='; \
                 img-src 'self' data:; connect-src 'self'; base-uri 'none'; \
                 form-action 'self'; frame-ancestors 'none'"
            )
        );
        // The CSP has no 'unsafe-inline': it holds only while the page loads
        // every script and style from a file. A Swagger UI update that adds
        // an inline <script> or <style> fails here, not only in the browser.
        let body = to_bytes(response.into_body(), BODY_LIMIT)
            .await
            .expect("response body");
        let html = String::from_utf8(body.to_vec()).expect("UTF-8 page");
        assert!(!html.contains("<style"), "inline <style> in the page");
        assert!(!html.contains(" style="), "inline style attribute");
        let scripts = html.matches("<script").count();
        assert_eq!(scripts, 3, "unexpected number of <script> tags");
        assert_eq!(
            html.matches("<script src=\"./").count(),
            scripts,
            "a <script> without a same-origin src"
        );
    }

    #[tokio::test]
    async fn swagger_ui_logo_style_matches_the_csp_hash() {
        // The only <style> the Swagger UI scripts create is the one inside
        // the top bar's SVG logo. Its text hashes (SHA-256, base64) to the
        // hash in the CSP:
        //   printf '%s' '<text>' | openssl dgst -sha256 -binary | base64
        // A Swagger UI update that changes the text, or adds another <style>,
        // fails here: recompute the hash and update SWAGGER_UI_CSP.
        const LOGO_STYLE: &str =
            ".logo_small_svg__cls-2{fill:#fff}.logo_small_svg__cls-3{fill:#85ea2d}";
        const LOGO_STYLE_HASH: &str = "'sha256-RL3ie0nH+Lzz2YNqQN83mnU0J1ot4QL7b99vMdIX99w='";

        let mut style_elements = 0;
        for file in ["swagger-ui-bundle.js", "swagger-ui-standalone-preset.js"] {
            let (status, body) = get(&format!("/swagger-ui/{file}")).await;
            assert_eq!(status, StatusCode::OK, "{file}");
            let script = String::from_utf8(body).expect("UTF-8 script");
            style_elements += script.matches("createElement(\"style\"").count();
            if file == "swagger-ui-standalone-preset.js" {
                assert_eq!(
                    script
                        .matches(&format!("createElement(\"style\",null,\"{LOGO_STYLE}\")"))
                        .count(),
                    1,
                    "logo <style> text changed in {file}"
                );
            }
        }
        assert_eq!(style_elements, 1, "a new inline <style> in the Swagger UI");

        let (_, headers) = headers_of(request(Method::GET, "/swagger-ui/")).await;
        let csp = headers[header::CONTENT_SECURITY_POLICY].to_str().unwrap();
        assert!(csp.contains(LOGO_STYLE_HASH), "{csp}");
        assert!(!csp.contains("unsafe-inline"), "{csp}");
    }

    #[tokio::test]
    async fn cors_is_permissive_for_any_origin() {
        let request = Request::builder()
            .uri("/health")
            .header(header::ORIGIN, "https://example.org")
            .body(Body::empty())
            .unwrap();
        let response = app().oneshot(request).await.expect("router is infallible");
        assert_eq!(response.headers()[header::ACCESS_CONTROL_ALLOW_ORIGIN], "*");
    }
}
