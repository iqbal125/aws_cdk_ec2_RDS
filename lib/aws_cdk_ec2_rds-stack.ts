import * as cdk from "@aws-cdk/core"
import * as ec2 from "@aws-cdk/aws-ec2"
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2"
import {AutoScalingGroup} from "@aws-cdk/aws-autoscaling"
import * as codepipeline from "@aws-cdk/aws-codepipeline"
import * as codepipeline_actions from "@aws-cdk/aws-codepipeline-actions"
import * as codebuild from "@aws-cdk/aws-codebuild"
import * as codedeploy from "@aws-cdk/aws-codedeploy"
import {Bucket} from "@aws-cdk/aws-s3"

require("dotenv").config()

export class AwsCdkEc2RdsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    //Start stack

    //create vpc
    const vpc = new ec2.Vpc(this, "VPC")

    //create load balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
    })

    //Create server access logs for bucket
    const serverAccessLogsBucket = new Bucket(this, "MyFirstBucket")
    lb.logAccessLogs(serverAccessLogsBucket)

    //add load balancer listener
    const listener = lb.addListener("Listener", {
      port: 80,
    })

    //auto scaling group config
    const asg = new AutoScalingGroup(this, "ASG", {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(),
    })

    //create asg target group
    const targets = listener.addTargets("ApplicationFleet", {
      port: 8080,
      targets: [asg],
    })

    // Source Stage with github
    const sourceOutput = new codepipeline.Artifact()
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "GitHub_Source",
      owner: "iqbal125",
      repo: "react-express-sample",
      oauthToken: process.env.GITHUB_ACCESS_TOKEN,
      output: sourceOutput,
    })

    //Build Stage with nodejs app
    const project = new codebuild.PipelineProject(this, "MyProject", {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          build: {
            commands: ["npm install"],
          },
          post_build: {
            commands: ["npm start"],
          },
        },
      }),
    })

    const buildOutput = new codepipeline.Artifact()
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "CodeBuild",
      project,
      input: sourceOutput,
      outputs: [buildOutput],
    })

    //Deploy Stage to loadbalancer
    const deploymentGroup = new codedeploy.ServerDeploymentGroup(this, "DeploymentGroup", {
      loadBalancer: codedeploy.LoadBalancer.application(targets),
    })

    const deployAction = new codepipeline_actions.CodeDeployServerDeployAction({
      actionName: "CodeDeploy",
      input: buildOutput,
      deploymentGroup,
    })

    new codepipeline.Pipeline(this, "MyPipeline", {
      stages: [
        {
          stageName: "Source",
          actions: [sourceAction],
        },
        {
          stageName: "Build",
          actions: [buildAction],
        },
        {
          stageName: "Deploy",
          actions: [deployAction],
        },
      ],
    })
  }
}
