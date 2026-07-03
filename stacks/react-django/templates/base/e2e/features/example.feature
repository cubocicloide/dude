# Example feature — replace with your own scenarios
#
# Naming convention (ET001): file name must be snake_case.
# Each feature must have a matching steps file (ET002):
#   features/example.feature  →  steps/example.steps.ts

Feature: Application health

  Background:
    Given the application is running

  Scenario: Application is accessible
    Then the page title should not be empty
