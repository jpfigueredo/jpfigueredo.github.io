use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
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
            created_at: chrono::Utc::now().to_rfc3339(),
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
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    Ok(Json(item))
}

/// Application routes. Kept apart from `main` so tests can drive the same
/// `Router` in-process, without binding a socket.
fn app() -> Router {
    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/health", get(health_check))
        .route("/api/timeline", get(get_timeline))
        .route("/api/v1/items/{id}", get(get_item))
        .route("/api/v1/items", post(create_item))
        .layer(CorsLayer::permissive())
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
        http::{header, Method, Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    const BODY_LIMIT: usize = 1024 * 1024;

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
}
