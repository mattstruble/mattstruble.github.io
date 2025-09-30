---
title: SageRender
date: "2024-08-29T00:00:00Z"
description: A web app that blended augmented reality and artificial intelligence to create an interactive user experience for the Heineken® Formula 1 campaign. The campaign was the first time a brand has used web-based AR technology to power a live competition globally.
cover:
    src: sagerender.png
    alt: A white controller with the sagemaker logo in the middle.
tags:
- "Machine Learning"
- "AWS SageMaker"
- "Pipeline Automation"
- "YAML Configuration"
- "Open Source Tools"

---


SageRender is an open-source tool developed at Nike to manage SageMaker pipelines via hierarchical YAML configurations. It enables shared configuration definitions, overrides, and extensibility across multiple pipelines, reducing duplication and improving consistency. This capability was critical in migrating teams from legacy platforms to SageMaker, particularly when managing hundreds of pipelines with similar but slightly different configurations.

The tool was designed collaboratively across teams to accelerate migration efforts and provide a **robust, production-ready, open-source solution** that could scale efficiently.


## Problem

Teams faced several challenges:

- Defining hundreds of pipelines with shared base configurations and step-specific overrides.
- Referencing parameters, environment variables, or step outputs across multiple layers of hierarchical configurations.
- Migrating pipelines from legacy platforms to SageMaker under tight timelines, requiring a solution that reduced manual configuration work.
- Injecting fully-typed **SageMaker Parameter objects** into steps and processors, rather than just strings, ensuring pipeline correctness and type safety.

Existing approaches, such as YAML anchors, were insufficient because anchors work only within individual files and cannot resolve references across hierarchical configurations. A solution was needed that could **dynamically generate SageMaker objects** from hierarchical YAML references while remaining extensible and type-safe.


## Goals

The recursive parameter lookup system was designed with four primary goals:

1. **Correctness:** Ensure parameter references resolve to the intended SageMaker objects across pipelines, steps, and hierarchical levels.
2. **Backwards Compatibility:** Avoid breaking existing pipelines while adding new features.
3. **Performance:** Efficiently handle large configurations with many parameters and nested references.
4. **Extensibility:** Support multiple types of inline lookups (parameters, environment variables, step outputs), enabling reusable and composable pipelines.

By meeting these goals, SageRender allows teams to **quickly replicate and extend pipelines**, dramatically reducing manual configuration effort while maintaining pipeline correctness.


## Implementation

The solution uses **PyYAML** for parsing YAML and **Phiera** for hierarchical configuration loading. Lookup keys are prefixed to indicate the type of object to resolve:

- `param:foo` → resolves to a SageMaker Parameter object (e.g., `ParameterString`, `ParameterInteger`)
- `env:region` → resolves to environment-specific values
- `step:train` → resolves to outputs from previous pipeline steps

**Recursive lookup mechanism:**

- Each reference is resolved into a **SageMaker object**, not a string.
- A **lookup stack** tracks currently resolving keys to detect cycles and prevent infinite recursion.
- **Memoization** caches resolved objects for performance in large pipelines.
- Substitutions occur **before pipeline step creation**, preserving immutability.
- Partial substitutions and hierarchical overrides are supported, allowing dynamic and composable pipelines.

This approach allows steps and processors to receive **real SageMaker objects** directly, enabling pipelines to be **type-safe, fully parameterized, and easily reusable** across teams.


## Example Usage

```yaml
# global.yaml
parameters:
  region: !!sagemaker.ParameterString
    name: "region"
    default_value: "us-east-1"
  env: !!sagemaker.ParameterString
    name: "env"
    default_value: "dev"
  model_name: !!sagemaker.ParameterString
    name: "model_name"
    default_value: "forecast"

# pipeline.yaml
steps:
  preprocess:
    input: param:env          # Injects SageMaker ParameterString object
    output: param:env         # Reuses the same Parameter object
  train:
    model: param:model_name   # Injects ParameterString object
    region: param:region      # Injects ParameterString object
    previous_step_output: step:preprocess.output  # Injects step output
```

* `param:env` and `param:model_name` are **resolved into SageMaker Parameter objects**.
* `step:preprocess.output` references a step’s output object.
* Any step or processor that accepts SageMaker objects can consume these directly, maintaining pipeline correctness and type safety.

By leveraging hierarchical configurations, pipelines could be **quickly duplicated or extended** without rewriting configuration for each new instance.

---

## Challenges

1. **Cycle Detection:** Preventing infinite loops in parameter references.
2. **Backwards Compatibility:** Maintaining the behavior of existing pipelines while adding new functionality.
3. **Performance:** Avoiding redundant lookups in large, nested configurations.
4. **Cross-File References:** Supporting references across multiple YAML files, which YAML anchors alone cannot handle.

---

## Results

The recursive lookup system enabled:

* Migration of hundreds of forecasting pipelines to SageMaker in just a few months.
* Rapid creation of new pipelines based on shared hierarchical configuration layers.
* Reliable, repeatable pipelines due to structured and tested configuration practices.
* Dynamic injection of SageMaker Parameter objects into pipeline steps and processors, improving type safety and developer productivity.
* Seamless collaboration across multiple teams, turning a proof-of-concept into a **robust, open-source tool** now available for reuse.

---

## Lessons Learned

* **Anchors are insufficient** for hierarchical YAML systems; explicit recursive lookup is necessary for cross-file references.
* **Backwards compatibility** is critical when extending widely used tools.
* **Memoization and cycle detection** are essential for correctness and performance in recursive resolution.
* **Design for extensibility:** Ideally, configuration resolution supports multiple backend providers (SageMaker, Databricks, etc.), even if initial timelines require focusing on a single platform.

---

## Reflection

Contributing to SageRender gave me the opportunity to impact multiple teams and collaborate on a project with broad organizational reach. Implementing recursive lookups for SageMaker objects demonstrated how thoughtful configuration tooling can scale hundreds of pipelines while maintaining correctness, type safety, and reuse. It reinforced the importance of **building systems that reduce friction for engineers** and enable rapid, reliable pipeline deployment.

---

## Repository

SageRender is available as an open-source project: [github.com/Nike-Inc/sagerender](https://github.com/Nike-Inc/sagerender)
