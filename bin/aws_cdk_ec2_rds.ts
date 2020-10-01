#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsCdkEc2RdsStack } from '../lib/aws_cdk_ec2_rds-stack';

const app = new cdk.App();
new AwsCdkEc2RdsStack(app, 'AwsCdkEc2RdsStack');
