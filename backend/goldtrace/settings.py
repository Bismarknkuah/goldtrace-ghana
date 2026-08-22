"""
Django settings for GOLDTRACE GHANA.

National Gold Supply Chain Intelligence & Traceability System (GoldBod).
Backend: Django 6 + Django REST Framework + Django MongoDB Backend (MongoDB Atlas).
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(key, default=None):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    return str(os.environ.get(key, default)).lower() in ("1", "true", "yes", "on")


# --------------------------------------------------------------------------- #
# Core / security
# --------------------------------------------------------------------------- #
SECRET_KEY = env("DJANGO_SECRET_KEY", "django-insecure-dev-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = list({
    *(h.strip() for h in env("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()),
    "localhost", "127.0.0.1", ".up.railway.app", ".railway.app",
})
CSRF_TRUSTED_ORIGINS = list({
    *(o.strip() for o in env("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()),
    "https://*.up.railway.app", "https://goldtrace-ghana.vercel.app",
})

# --------------------------------------------------------------------------- #
# Applications
# --------------------------------------------------------------------------- #
DJANGO_APPS = [
    "goldtrace.apps.MongoAdminConfig",
    "goldtrace.apps.MongoAuthConfig",
    "goldtrace.apps.MongoContentTypesConfig",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_mongodb_backend",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "drf_spectacular",
    "corsheaders",
]

LOCAL_APPS = [
    "core",
    "accounts",
    "miners",
    "production",
    "trading",
    "exports",
    "gis",
    "logistics",
    "intelligence",
    "revenue",
    "security",
    "compliance",
    "licensing",
    "pricing",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.AuditLogMiddleware",
]

ROOT_URLCONF = "goldtrace.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "goldtrace.wsgi.application"
ASGI_APPLICATION = "goldtrace.asgi.application"

# --------------------------------------------------------------------------- #
# Database  (MongoDB Atlas via django-mongodb-backend)
# --------------------------------------------------------------------------- #
DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "HOST": env("MONGODB_URI", "mongodb://localhost:27017/"),
        "NAME": env("MONGODB_NAME", "goldtrace"),
    },
}
DATABASE_ROUTERS = ["django_mongodb_backend.routers.MongoRouter"]

DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"

# Contrib apps ship SQL-oriented migrations; route them to the Mongo variants
# bundled by the official MongoDB project template.
MIGRATION_MODULES = {
    "admin": "mongo_migrations.admin",
    "auth": "mongo_migrations.auth",
    "contenttypes": "mongo_migrations.contenttypes",
}

# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --------------------------------------------------------------------------- #
# DRF + JWT + OpenAPI
# --------------------------------------------------------------------------- #
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "core.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "auth": "10/min",
        "verify": "60/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "GOLDTRACE GHANA API",
    "DESCRIPTION": "National Gold Supply Chain Intelligence & Traceability System.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #
CORS_ALLOWED_ORIGINS = list({
    *(o.strip() for o in env("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()),
    "http://localhost:5173", "http://localhost:3000",
    "https://goldtrace-ghana.vercel.app",
})
# Also allow any *.vercel.app preview deployment of this project.
CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://goldtrace-ghana.*\.vercel\.app$"]

# --------------------------------------------------------------------------- #
# Celery / Redis
# --------------------------------------------------------------------------- #
CELERY_BROKER_URL = env("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", False)
CELERY_TASK_TIME_LIMIT = 600

_REDIS_CACHE_URL = env("REDIS_CACHE_URL", "")
if _REDIS_CACHE_URL:
    CACHES = {"default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": _REDIS_CACHE_URL,
    }}
else:
    # In-memory cache: no external Redis required. Rate-limiting (which backs
    # the /auth/token/ endpoint) works out of the box and never fails a login.
    CACHES = {"default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "goldtrace-cache",
    }}

# --------------------------------------------------------------------------- #
# i18n / static / media
# --------------------------------------------------------------------------- #
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Accra"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# Behind Railway/Vercel proxies, trust the forwarded HTTPS scheme.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

# --------------------------------------------------------------------------- #
# Domain constants
# --------------------------------------------------------------------------- #
# Anchoring hash of custody events to the permissioned ledger (Hyperledger
# Fabric) is performed asynchronously; this toggles the live network call.
BLOCKCHAIN_ANCHORING_ENABLED = env_bool("BLOCKCHAIN_ANCHORING_ENABLED", False)
FABRIC_GATEWAY_URL = env("FABRIC_GATEWAY_URL", "")
GOLD_PASSPORT_BASE_URL = env("GOLD_PASSPORT_BASE_URL", "https://verify.goldtrace.gov.gh")
# Government revenue assumptions (configurable).
GOLD_PRICE_GHS_PER_G = float(env("GOLD_PRICE_GHS_PER_G", "900"))
MINERAL_ROYALTY_RATE = float(env("MINERAL_ROYALTY_RATE", "0.05"))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"format": '{"level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}'},
        "plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "json"},
        "trace": {"class": "logging.StreamHandler", "formatter": "plain"},
    },
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
    "loggers": {
        # Full, readable tracebacks for any 500 land in the Railway logs.
        "django.request": {"handlers": ["trace"], "level": "ERROR", "propagate": False},
    },
}
