#!/bin/bash

# Development Docker helper script

set -e

COMMAND=${1:-help}

case $COMMAND in
  "start")
    echo "Starting Faxi development environment..."
    docker-compose up -d
    echo "Services started. Access:"
    echo "  - Faxi API: http://localhost:4000"
    echo "  - Test UI: http://localhost:4000/test"
    echo "  - pgAdmin: http://localhost:5050 (admin@faxi.jp / admin)"
    echo "  - Redis Commander: http://localhost:8081"
    echo "  - MinIO Console: http://localhost:9001 (minioadmin / minioadmin)"
    ;;
  "stop")
    echo "Stopping Faxi development environment..."
    docker-compose down
    ;;
  "restart")
    echo "Restarting Faxi development environment..."
    docker-compose restart faxi-app
    ;;
  "logs")
    SERVICE=${2:-faxi-app}
    docker-compose logs -f $SERVICE
    ;;
  "shell")
    docker-compose exec faxi-app sh
    ;;
  "migrate")
    echo "Running database migrations..."
    docker-compose --profile migration run --rm migrate
    ;;
  "reset")
    echo "Resetting development environment (WARNING: This will delete all data)..."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      docker-compose down -v
      docker-compose up -d
      echo "Environment reset complete."
    else
      echo "Reset cancelled."
    fi
    ;;
  "build")
    echo "Building Faxi application..."
    docker-compose build faxi-app
    ;;
  "status")
    docker-compose ps
    ;;
  "help")
    echo "Faxi Development Docker Helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  start     Start the development environment"
    echo "  stop      Stop the development environment"
    echo "  restart   Restart the main application"
    echo "  logs      Show logs (optionally specify service name)"
    echo "  shell     Open shell in the main application container"
    echo "  migrate   Run database migrations"
    echo "  reset     Reset environment (deletes all data)"
    echo "  build     Build the application image"
    echo "  status    Show service status"
    echo "  help      Show this help message"
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo "Run '$0 help' for available commands."
    exit 1
    ;;
esac