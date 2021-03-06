(function () {
    'use strict';

    angular
      .module('reviewStudentApp', ['ui.bootstrap','reviewProjectProposals', 'ProjectProposalService'])
      .filter('custom', function() {
        return function(input, search) {
           console.log(search)
           console.log(input)
          if (!input) return input;
          if (!search) return input;
          var expected = ('' + search).toLowerCase();
          var result = {};
          angular.forEach(input, function(value, key) {
            var actual = ('' + value).toLowerCase();
            if (actual.indexOf(expected) !== -1) {
              result[key] = value;
            }
          });
          return result;
        }
      })
      .controller('reviewStudentAppController',
    function ($window,$state, $scope, reviewStudentAppService, ToDoService,User, reviewPPS, ProjectService, ProfileService, adminService, DateTimeService) {
        var vm = this;

        vm.currUserProfile;
        vm.profile;
		vm.projects;
		vm.toDoData;
		vm.members = []; //Used to get members email and their respective projects
		vm.membs = []; //Used to get Full information for members (including their application to a project)
		vm.ApproveData = ApproveData;
		vm.RejectData = RejectData;
		vm.UndoStudent = UndoStudent;
		vm.DeleteLog = deletelog;
		vm.FindToDoMatch = findToDoMatch;
		vm.logs;
      vm.sortType     = 'name'; // set the default sort type
      vm.sortReverse  = false;
		vm.adminEmail;
      $scope.orderByField = ''
      $scope.reverseSort = false;
      $scope.orderByFieldApp = ''
      $scope.reverseSortApp = false;
        adminService.getAdminSettings().then(function (data)
        {
            var adminData;
            adminData = data;

            console.log(adminData);
            console.log(adminData.current_email);
            vm.adminEmail = adminData.current_email;
        });
        init();
        function init() {
            loadProjects();
           // setTimeout(loadLogs,1000) // for those who see this, i'm feeling lazy, change this to a promise and what not
            loadLogs();
            loadToDos();
        }
//<!----User Story: prof-26 | VIP-9.0, atiwa007 (Prodessors can view and search students by their attributes.)-->
        //this function makes a request to pull from the database and displays the result.
        function loadLogs() {
            reviewStudentAppService.loadLog().then(function (data) {
               
                vm.logs = data;
            });
        }

        //Loads all project information for active projects including applications from interested students
        function loadProjects() {
            reviewStudentAppService.loadProjects().then(function (data) {
               data = data.filter(proj=>{
                  return proj.owner_email == vm.adminEmail
               })
               console.log(data)
                vm.projects = data;
                for (var i = 0; i < vm.projects.length; i++) {
                    for (var x = 0; x < vm.projects[i].members.length; x++) {
                        vm.members[x] = [vm.projects[i]._id, vm.projects[i].title, vm.projects[i].members[x], vm.projects[i].members_detailed[x]];
                    }
                }
                loadData();
            });
        }

        //Loads all Student information and matches them to their student applications
        function loadData() {
            reviewStudentAppService.loadProfile(vm.adminEmail).then(function (data) {
                vm.profile = data;

                var tempFilter = [];
                var tmpCount = 0;
               //  console.log(data)
                vm.profile.forEach(function (obj) {
                    vm.projects.forEach(function (obj2) {
                        obj2.members.forEach(function (obj3) {
                           //  console.log("test: " + obj3);
                            if (obj.email == obj3 && !obj.joined_project) {
                                console.log("match: " + obj.lastName + ", project: " + obj2.title);
                                obj.project = obj2.title;
                                obj.projectid = obj2._id;
                                obj.fullName = obj.firstName + " " + obj.lastName;
                                tempFilter[tmpCount] = obj;
                                ++tmpCount;
                            }
                        });
                    });
                });

               //  tempFilter = Object.assign({},tempFilter,{
               //     facultyEmail: vm.adminEmail
               //  })
                vm.membs = tempFilter;
               //  console.log(vm.membs)

            });
        }

        function loadToDos()
        {
            ProfileService.loadProfile().then(function (dt)
            {
                var profileData = dt;
                vm.currUserProfile = profileData;

                ToDoService.loadMyToDoType(vm.currUserProfile, "student").then(function (data)
                {
                    vm.toDoData = data.data;
                });
            });;
        }

        function findToDoMatch(user)
        {
            vm.toDoData.forEach(function (toDoObj)
            {
                var equalDate, containsName, containsProj;
                if (!toDoObj.read || toDoObj.owner_id == null)
                {
                    equalDate = DateTimeService.DateTimeEquals(toDoObj.time, user.appliedDate);
                    containsName = ( (toDoObj.todo).includes(user.firstName)
                    || (toDoObj.todo).includes(user.lastName) );
                    containsProj = (toDoObj.todo).includes(user.project);

                    if (containsProj && equalDate && containsName)
                    {
                        ToDoService.markAsRead(toDoObj._id).then(function (data)
                        {
                            console.log(user);
                            console.log(toDoObj.todo);
                        });
                    }
                }
            });

        }

        function ApproveData(user) {

            loading();
            findToDoMatch(user);
            //reviewStudentAppService.RemoveFromProject(user.projectid, user.email).then(function(data){
            //	$scope.result = "Approved";

            //});

            user.joined_project = true;
   			ProjectService.getProject(user.projectid).then(function (project) {
   				user.project = project.title;
   				User.update({user: user});
   			});

            reviewStudentAppService.AddToProject(user._id, user.projectid).then(function (data) {
                $scope.result = "Approved";

                console.log("send mail for project " + user.project + " to " + user.email);

                var todo = {
                    owner: "Student",
                    owner_id: user._id,
                    todo: "Dear student, the project titled: " + user.project + " has accepted your application.",
                    type: "project",
                    link: "/#/to-do"
                };
                ToDoService.createTodo(todo).then(function (success) {

                }, function (error) {

                });

                var subject = "Project Application Approved";
                var email_msg =
                    {
                        recipient: user.email,
                        text: "The project you joined has accepted you to participate.",
                        subject: subject,
                        recipient2: vm.adminEmail,
                        text2: "The application of " + user.firstName + " " + user.lastName + " to work on project '" +
                            user.project + "' has been approved.",
                        subject2: subject
                    };
                User.nodeEmail(email_msg);
            });

            // User Story #1144
            success_msg();
            var log = {
                projectid: user.projectid,
                student: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                studentemail: user.email,
                selectProject: user.project,
                gender: user.gender,
                department: user.department,
                college: user.college,
                action: "Approved",
                type: "student",
                skillItem: user.skillItem,
                appliedDate: user.appliedDate
            };
            reviewPPS.createLog(log).then(function (success) {

            }, function (error) {
            });

        }

        function RejectData(user) {

            loading();
            findToDoMatch(user);
            if (user.projectid != null) {
                reviewStudentAppService.RemoveFromProject(user.projectid, user.email, user.fullName).then(function (data) {
                    $scope.result = "Rejected";
                    var todo = {
                        owner: "Student",
                        owner_id: user._id,
                        todo: "Dear student, the project titled: " + user.project + " has rejected your application.",
                        type: "project",
                        link: "/#/to-do"
                    };
                    ToDoService.createTodo(todo).then(function (success) {

                    }, function (error) {

                    });

                    var subject = "Project Application Rejected";
                    var email_msg =
                        {
                            recipient: user.email,
                            text: "The project you applied for has rejected you from joining.",
                            subject: subject,
                            recipient2: vm.adminEmail,
                            text2: "The application of " + user.firstName + " " + user.lastName + " to work on project '" +
                            user.project + "' has been rejected.",
                            subject2: subject
                        };
                    User.nodeEmail(email_msg);

                });
                //User Story #1144
                var log = {
                    projectid: user.projectid,
                    student: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    studentemail: user.email,
                    selectProject: name,
                    gender: user.gender,
                    department: user.department,
                    college: user.college,
                    action: "Rejected",
                    type: "student",
                    skillItem: user.skillItem,
                    appliedDate: user.appliedDate
                };
                reviewPPS.createLog(log).then(function (success) {
                }, function (error) {
                });

                reject_msg();

            }
            else {
                console.log("PID IS UNDEFINED!");
            }

        }

        function UndoStudent(log) {

            loading();
            if (log.action == "Rejected") {
                //check if original user is in project first
                reviewStudentAppService.loadUser(log.student).then(function (data) {
                    var thisStud = data;
                    if (thisStud.joined_project == false) {
                        var sProject;
                        ProjectService.getProject(log.projectid).then(function (data) {
                            var project = data;
                            console.log(project);
                            for (i = 0; i < project.members.length; i++) {
                                if (project.members[i] === log.email) {
                                    console.log("fail");
                                    return;
                                }
                            }
                            for (i = 0; i < project.members_detailed.length; i++) {
                                if (project.members_detailed[i] === (log.firstName + " " + log.lastName)) {
                                    console.log("fail");
                                    return;
                                }
                            }
                            project.members[project.members.length] = log.studentemail;
                            project.members_detailed[project.members_detailed.length] = log.firstName + " " + log.lastName;
                            //Call service to create a student application:
                            ProjectService.editProject(project, project._id).then(function (success) {
                                }
                            );
                        });

                        //Call service to delete in log
                        reviewPPS.UndoLog(log._id).then(function (success) {
                        }, function (error) {
                        });
                        undo_msg();
                    }
                    else {
                        undoerror_msg(); //Student is in a project
                    }

                });


            }
            else if (log.action == "Approved") {
                //check if original user is in project first
                console.log("FOUND YA!! " + log.student);
                reviewStudentAppService.loadUser(log.student).then(function (data) {
                    var thisStud = data;
                    console.log(thisStud);
                    if (thisStud.joined_project == true) {
                        ProjectService.getProject(log.projectid).then(function (data) {
                            var proj = data;
                            //check if he is in the same project
                            console.log(thisStud._id);
                            if (thisStud.project == proj._id || thisStud.project == proj.title) {
                                thisStud.joined_project = false;
                                //call service to create a student application
                                reviewStudentAppService.setJoinedProjectFalse(thisStud._id).then(function (data) {
                                });


                                //Call service to delete in log
                                reviewPPS.UndoLog(log._id).then(function (success) {
                                }, function (error) {
                                });
                                undo_msg();
                            }
                            else {
                                undoerror2_msg(); //student is in a different project
                            }
                        });
                    }
                    else {
                        undoerror3_msg(); //Student is not in a project
                    }

                });


            }

        }


        function deletelog(log) {
            //Call service to delete in log
            reviewPPS.UndoLog(log._id).then(function (success) {
                logdelete_msg()
            }, function (error) {
            });
        }


        function loading() {
            swal({
                    title: '',
                    text: 'Loading Please Wait...',
                    html: true,
                    timer: 10000,
                    showConfirmButton: false
                }
            );
        }

        function logdelete_msg() {
            swal({
                    title: "Log Deleted",
                    text: "This log has been successfully deleted",
                    type: "info",
                    confirmButtonText: "Okay",
                    allowOutsideClick: true,
                    timer: 7000,
                }, function () {
                    $window.location.reload();
                }
            );
        };


        function success_msg() {
            swal({
                    title: "Accepted",
                    text: "User has been accepted and notified",
                    type: "info",
                    confirmButtonText: "Continue",
                    allowOutsideClick: true,
                    timer: 10000,
                }, function () {
                    $window.location.reload();
                }
            );
        };


        function undo_msg() {
            swal({
                    title: "Undo Successful",
                    text: "This student application now requires approval",
                    type: "info",
                    confirmButtonText: "Okay",
                    allowOutsideClick: true,
                    timer: 7000,
                }, function () {
                    $window.location.reload();
                }
            );
        };

        //Student is in a project
        function undoerror_msg() {
            swal({
                    title: "Undo Successful",
                    text: "This student is already in a project",
                    type: "info",
                    confirmButtonText: "Okay",
                    allowOutsideClick: true,
                    timer: 7000,
                }, function () {
                }
            );
        };

        //Student is in a different project
        function undoerror2_msg() {
            swal({
                    title: "Undo Successful",
                    text: "This student is already in a different project",
                    type: "info",
                    confirmButtonText: "Okay",
                    allowOutsideClick: true,
                    timer: 7000,
                }, function () {
                }
            );
        };
        //Student is not in a project
        function undoerror3_msg() {
            swal({
                    title: "Undo Successful",
                    text: "This student is not in a project",
                    type: "info",
                    confirmButtonText: "Okay",
                    allowOutsideClick: true,
                    timer: 7000,
                }, function () {
                }
            );
        };

        function reject_msg() {
            swal({
                    title: "User Rejected",
                    text: "User has been denied and notified",
                    type: "warning",
                    confirmButtonText: "Continue",
                    allowOutsideClick: true,
                    timer: 10000,
                }, function () {
                    $window.location.reload();
                }
            );
        };
    });
}());
